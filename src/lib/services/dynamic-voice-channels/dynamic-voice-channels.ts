import defaults from "../../../defaults.js";
import { DynamicVoiceChannel, Guild } from "../../database/structs/guild.js";
import { isVoice } from "../../utils.js";
import { LocalService } from "../service.js";
import * as Discord from "discordeno";

type Configuration = NonNullable<Guild["features"]["server"]["features"]>["dynamicVoiceChannels"];

type WithVoiceStates<T> = T & { voiceStates: Discord.VoiceState[] };
type DynamicVoiceChannelData = {
	parent: WithVoiceStates<{ channel: Discord.Channel }>;
	children: WithVoiceStates<{ id: bigint }>[];
	configuration: DynamicVoiceChannel;
};

class DynamicVoiceChannelService extends LocalService {
	readonly oldVoiceStates: Map</*userId:*/ bigint, Discord.VoiceState> = new Map();

	get configuration(): Configuration | undefined {
		const guildDocument = this.guildDocument;
		if (guildDocument === undefined) {
			return undefined;
		}

		return guildDocument.data.features.server.features?.dynamicVoiceChannels;
	}

	get channels(): DynamicVoiceChannelData[] | undefined {
		const [configuration, guild] = [this.configuration, this.guild];
		if (configuration === undefined || guild === undefined) {
			return undefined;
		}

		if (!configuration.enabled) {
			return undefined;
		}

		const channelIdConfigurationTuples = configuration.channels.map<[bigint, DynamicVoiceChannel]>(
			(channelConfiguration) => [BigInt(channelConfiguration.id), channelConfiguration],
		);
		const parentChannelIds = channelIdConfigurationTuples.map(([channelId, _]) => channelId);

		const channelsAll = guild.channels
			.filter((channel) => isVoice(channel))
			.array()
			.sort((a, b) => {
				if (a.position === b.position) {
					return Number(a.id - b.id);
				}

				if (a.position === undefined) {
					return b.position ?? -1;
				} else if (b.position === undefined) {
					return a.position ?? 1;
				}

				return a.position - b.position;
			});
		const channelIds = channelsAll.map((channel) => channel.id);

		const voiceStateByUserId = guild.voiceStates.filter((voiceState) => voiceState.channelId !== undefined).array();
		const voiceStatesByChannelId = new Map<bigint, Discord.VoiceState[]>(
			channelIds.map((channelId) => [
				channelId,
				voiceStateByUserId.filter((voiceState) => voiceState.channelId === channelId),
			]),
		);

		const parentChannels = channelsAll.filter((channel) => parentChannelIds.includes(channel.id));

		const channels: DynamicVoiceChannelData[] = [];
		for (const parentChannel of parentChannels.reverse()) {
			const configuration = channelIdConfigurationTuples.find(([channelId, _]) => channelId === parentChannel.id)?.[1];
			if (configuration === undefined) {
				return;
			}

			const voiceStates = voiceStatesByChannelId.get(parentChannel.id) ?? [];

			const childChannels: DynamicVoiceChannelData["children"] = [];
			while (channelsAll.length !== 0) {
				const channel = channelsAll.pop();
				if (channel === undefined) {
					break;
				}

				const voiceStates = voiceStatesByChannelId.get(channel.id) ?? [];

				// If the channel is a parent channel.
				if (parentChannelIds.includes(channel.id)) {
					continue;
				}

				// If the channel is a child channel.
				if (channel.name === parentChannel.name) {
					childChannels.push({ id: channel.id, voiceStates });
				}
			}

			channels.push({ parent: { channel: parentChannel, voiceStates }, children: childChannels, configuration });
		}

		return channels;
	}

	async start(bot: Discord.Bot): Promise<void> {
		const [channels, configuration, guild] = [this.channels, this.configuration, this.guild];
		if (channels === undefined || configuration === undefined || guild === undefined) {
			return;
		}

		if (!configuration.enabled) {
			return;
		}

		const voiceStatesAll = channels.flatMap((channel) => [
			...channel.parent.voiceStates,
			...channel.children.flatMap((channel) => channel.voiceStates),
		]);
		for (const voiceState of voiceStatesAll) {
			this.voiceStateUpdate(bot, voiceState);
		}

		for (const { parent, children, configuration } of channels) {
			const groupChannelsCount = children.length + 1;
			const surplusVacantChannels = Math.max(
				0,
				(configuration.maximum ?? defaults.MAX_VOICE_CHANNELS) - groupChannelsCount,
			);

			const isParentVacant = parent.voiceStates.length === 0;
			const vacantChannelIds = children.filter((channel) => channel.voiceStates.length === 0);
			const minimumVoiceChannels = configuration.minimum ?? defaults.MIN_VOICE_CHANNELS;
			if (
				(isParentVacant ? 1 : 0) + vacantChannelIds.length ===
				(configuration.minimum ?? defaults.MIN_VOICE_CHANNELS) + 1
			) {
				return;
			}

			const channelIdsToDelete = vacantChannelIds
				.slice(Math.min((minimumVoiceChannels === 0 ? 0 : minimumVoiceChannels - 1) - surplusVacantChannels, 0))
				.map((channel) => channel.id);
			for (const channelId of channelIdsToDelete) {
				await Discord.deleteChannel(bot, channelId);
			}
		}
	}

	async voiceStateUpdate(bot: Discord.Bot, newVoiceState: Discord.VoiceState): Promise<void> {
		const [channels, configuration, guild] = [this.channels, this.configuration, this.guild];
		if (channels === undefined || configuration === undefined || guild === undefined) {
			return;
		}

		const oldVoiceState = this.oldVoiceStates.get(newVoiceState.userId);

		if (oldVoiceState === undefined || oldVoiceState.channelId === undefined) {
			this.onConnect(bot, newVoiceState);
		} else if (newVoiceState.channelId === undefined) {
			this.onDisconnect(bot, oldVoiceState);
		} else {
			this.onConnect(bot, newVoiceState);
			this.onDisconnect(bot, oldVoiceState);
		}

		this.oldVoiceStates.set(newVoiceState.userId, newVoiceState);
	}

	private async onConnect(bot: Discord.Bot, newVoiceState: Discord.VoiceState): Promise<void> {
		const channels = this.channels;
		if (channels === undefined) {
			return;
		}

		const channelId = newVoiceState.channelId ?? 0n;

		const channelData = channels.find(
			(channel) =>
				channel.parent.channel.id === channelId || channel.children.some((channel) => channel.id === channelId),
		);
		if (channelData === undefined) {
			return;
		}

		const { parent, configuration, children } = channelData;

		const channel = parent.channel.id === channelId ? parent : children.find((channel) => channel.id === channelId);
		if (channel === undefined) {
			return;
		}

		// If somebody was already connected to the channel, do not process.
		if (channel.voiceStates.length !== 1) {
			return;
		}

		const vacantChannels = [parent, ...children].filter((channel) => channel.voiceStates.length === 0);
		if (vacantChannels.length === (configuration.minimum ?? defaults.MIN_VOICE_CHANNELS) + 1) {
			return;
		}

		// If the channel limit has already been reached, do not process.
		const groupChannels = children.length + 1;
		if (groupChannels >= (configuration.maximum ?? defaults.MAX_VOICE_CHANNELS)) {
			return;
		}

		if (parent.channel.name === undefined) {
			return;
		}

		Discord.createChannel(bot, this.guildId, {
			name: parent.channel.name,
			type: Discord.ChannelTypes.GuildVoice,
			parentId: parent.channel.parentId,
			position: parent.channel.position,
		}).catch(() => this.client.log.warn(`Failed to create voice channel on guild with ID ${this.guildId}.`));
	}

	private async onDisconnect(bot: Discord.Bot, oldVoiceState: Discord.VoiceState): Promise<void> {
		const channels = this.channels;
		if (channels === undefined) {
			return;
		}

		const channelId = oldVoiceState.channelId ?? 0n;

		const channelData = channels.find(
			(channel) =>
				channel.parent.channel.id === channelId || channel.children.some((channel) => channel.id === channelId),
		);
		if (channelData === undefined) {
			return;
		}

		const { parent, configuration, children } = channelData;

		const channel = parent.channel.id === channelId ? parent : children.find((channel) => channel.id === channelId);
		if (channel === undefined) {
			return;
		}

		// If somebody is still connected to the channel, do not process.
		if (channel.voiceStates.length !== 0) {
			return;
		}

		const isParentVacant = parent.voiceStates.length === 0;
		const vacantChannels = children.filter((channel) => channel.voiceStates.length === 0);
		if (
			(isParentVacant ? 1 : 0) + vacantChannels.length ===
			(configuration.minimum ?? defaults.MIN_VOICE_CHANNELS) + 1
		) {
			return;
		}

		const lastVacantChannelId = vacantChannels.at(-1)?.id;
		if (lastVacantChannelId === undefined) {
			return;
		}

		Discord.deleteChannel(bot, lastVacantChannelId).catch(() =>
			this.client.log.warn(`Failed to delete voice channel on guild with ID ${oldVoiceState.guildId}.`),
		);
	}
}

export { DynamicVoiceChannelService };
