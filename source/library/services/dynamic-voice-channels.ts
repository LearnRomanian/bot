import type { Client } from "rost/client";
import { Collector } from "rost/collectors";
import type { DynamicVoiceChannel } from "rost/models/documents/guild";
import type { Guild } from "rost/models/guild";
import { LocalService } from "rost/services/service";

type VoiceChannel = Rost.Channel & { type: Discord.ChannelTypes.GuildVoice };

function isVoice(channel: Rost.Channel): channel is VoiceChannel {
	return channel.type === Discord.ChannelTypes.GuildVoice;
}

type WithVoiceStates<T> = T & { voiceStates: Rost.VoiceState[] };
type DynamicVoiceChannelData = {
	parent: WithVoiceStates<{ channel: Rost.Channel }>;
	children: WithVoiceStates<{ id: bigint }>[];
	configuration: DynamicVoiceChannel;
};

class DynamicVoiceChannelService extends LocalService {
	readonly oldVoiceStates: Map</*userId:*/ bigint, Rost.VoiceState>;

	readonly #voiceStateUpdates: Collector<"voiceStateUpdate">;

	get configuration(): NonNullable<Guild["features"]["dynamicVoiceChannels"]> {
		return this.guildDocument.feature("dynamicVoiceChannels");
	}

	get channels(): DynamicVoiceChannelData[] {
		const channelIdConfigurationTuples = this.configuration.channels.map<[bigint, DynamicVoiceChannel]>(
			(channelConfiguration) => [BigInt(channelConfiguration.id), channelConfiguration],
		);
		const parentChannelIds = channelIdConfigurationTuples.map(([channelId, _]) => channelId);

		const channelsAll = this.guild.channels
			.filter((channel) => isVoice(channel))
			.array()
			.sort((a, b) => {
				if (a.position === b.position) {
					return Number(a.id - b.id);
				}

				if (a.position === undefined) {
					return b.position ?? -1;
				}

				if (b.position === undefined) {
					return a.position ?? 1;
				}

				return a.position - b.position;
			});
		const channelIds = channelsAll.map((channel) => channel.id);

		const voiceStateByUserId = this.guild.voiceStates
			.filter((voiceState) => voiceState.channelId !== undefined)
			.array();
		const voiceStatesByChannelId = new Map<bigint, Rost.VoiceState[]>(
			channelIds.map((channelId) => [
				channelId,
				voiceStateByUserId.filter((voiceState) => voiceState.channelId === channelId),
			]),
		);

		const parentChannels = channelsAll.filter((channel) => parentChannelIds.includes(channel.id));

		const parentChannelById = new Map<bigint, DynamicVoiceChannelData>();
		for (const channel of channelsAll) {
			const voiceStates = voiceStatesByChannelId.get(channel.id) ?? [];

			const parentChannel = parentChannels.find((parentChannel) => parentChannel.name === channel.name);
			if (parentChannel === undefined) {
				continue;
			}

			const configuration = channelIdConfigurationTuples.find(
				([channelId, _]) => channelId === parentChannel.id,
			)?.[1];
			if (configuration === undefined) {
				continue;
			}

			if (!parentChannelById.has(parentChannel.id)) {
				const voiceStates = voiceStatesByChannelId.get(parentChannel.id) ?? [];
				parentChannelById.set(parentChannel.id, {
					parent: { channel: parentChannel, voiceStates },
					configuration,
					children: [],
				});
			}

			// If the channel is a parent channel.
			if (parentChannelIds.includes(channel.id)) {
				continue;
			}

			parentChannelById.get(parentChannel.id)?.children.push({ id: channel.id, voiceStates });
		}

		return Array.from(parentChannelById.values());
	}

	constructor(client: Client, { guildId }: { guildId: bigint }) {
		super(client, { identifier: "DynamicVoiceChannelService", guildId });

		this.oldVoiceStates = new Map();

		this.#voiceStateUpdates = new Collector({ guildId });
	}

	async start(): Promise<void> {
		this.#voiceStateUpdates.onCollect(this.#handleVoiceStateUpdate.bind(this));

		await this.client.registerCollector("voiceStateUpdate", this.#voiceStateUpdates);

		const voiceStatesAll = this.channels.flatMap((channel) => [
			...channel.parent.voiceStates,
			...channel.children.flatMap((channel) => channel.voiceStates),
		]);
		for (const voiceState of voiceStatesAll) {
			await this.#handleVoiceStateUpdate(voiceState);
		}

		for (const { parent, children, configuration } of this.channels) {
			const groupChannelsCount = children.length + 1;
			const surplusVacantChannels = Math.max(
				0,
				(configuration.maximum ?? constants.defaults.MAXIMUM_VOICE_CHANNELS) - groupChannelsCount,
			);

			const isParentVacant = parent.voiceStates.length === 0;
			const vacantChannelIds = children.filter((channel) => channel.voiceStates.length === 0);
			const minimumVoiceChannels = configuration.minimum ?? constants.defaults.MINIMUM_VOICE_CHANNELS;
			if (
				(isParentVacant ? 1 : 0) + vacantChannelIds.length ===
				(configuration.minimum ?? constants.defaults.MINIMUM_VOICE_CHANNELS) + 1
			) {
				return;
			}

			const channelIdsToDelete = vacantChannelIds
				.slice(Math.min((minimumVoiceChannels === 0 ? 0 : minimumVoiceChannels - 1) - surplusVacantChannels, 0))
				.map((channel) => channel.id);
			for (const channelId of channelIdsToDelete) {
				await this.client.bot.helpers.deleteChannel(channelId);
			}
		}
	}

	async stop(): Promise<void> {
		await this.#voiceStateUpdates.close();

		this.oldVoiceStates.clear();
	}

	async #handleVoiceStateUpdate(newVoiceState: Rost.VoiceState): Promise<void> {
		const oldVoiceState = this.oldVoiceStates.get(newVoiceState.userId);

		if (oldVoiceState?.channelId === undefined) {
			await this.#handleConnect(newVoiceState);
		} else if (newVoiceState.channelId === undefined) {
			await this.#handleDisconnect(oldVoiceState);
		} else {
			await this.#handleConnect(newVoiceState);
			await this.#handleDisconnect(oldVoiceState);
		}

		this.oldVoiceStates.set(newVoiceState.userId, newVoiceState);
	}

	async #handleConnect(newVoiceState: Rost.VoiceState): Promise<void> {
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

		const vacantChannels = [parent, ...children].filter((channel) => channel.voiceStates.length === 0);
		if (vacantChannels.length === (configuration.minimum ?? constants.defaults.MINIMUM_VOICE_CHANNELS) + 1) {
			return;
		}

		// If the channel limit has already been reached, do not process.
		const groupChannels = children.length + 1;
		if (groupChannels >= (configuration.maximum ?? constants.defaults.MAXIMUM_VOICE_CHANNELS)) {
			return;
		}

		if (parent.channel.name === undefined) {
			return;
		}

		await this.client.bot.helpers
			.createChannel(this.guildId, {
				name: parent.channel.name,
				type: Discord.ChannelTypes.GuildVoice,
				parentId: parent.channel.parentId,
				position: parent.channel.position,
			})
			.catch((error) =>
				this.log.warn(
					error,
					`Failed to create voice channel on ${this.client.diagnostics.guild(this.guildId)}.`,
				),
			);
	}

	async #handleDisconnect(oldVoiceState: Rost.VoiceState): Promise<void> {
		const channels = this.channels;
		if (channels === undefined) {
			return;
		}

		const channelId = oldVoiceState.channelId ?? 0n;

		const channelData = channels.findLast(
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
		if (channel.voiceStates.length > 0) {
			return;
		}

		const isParentVacant = parent.voiceStates.length === 0;
		const vacantChannels = children.filter((channel) => channel.voiceStates.length === 0);
		if (
			(isParentVacant ? 1 : 0) + vacantChannels.length ===
			(configuration.minimum ?? constants.defaults.MINIMUM_VOICE_CHANNELS) + 1
		) {
			return;
		}

		const lastVacantChannelId = vacantChannels.at(-1)?.id;
		if (lastVacantChannelId === undefined) {
			return;
		}

		this.client.bot.helpers
			.deleteChannel(lastVacantChannelId)
			.catch((error) =>
				this.log.warn(
					error,
					`Failed to delete voice channel on ${this.client.diagnostics.guild(this.guildId)}.`,
				),
			);
	}
}

export { DynamicVoiceChannelService };
