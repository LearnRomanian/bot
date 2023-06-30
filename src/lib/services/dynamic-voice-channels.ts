import configuration from "../../configuration.js";
import { Client, extendEventHandler, isServicing } from "../client.js";
import { isVoice } from "../utils.js";
import { ServiceStarter } from "./services.js";
import { Bot, Channel, ChannelTypes, Collection, Guild, VoiceState, createChannel, deleteChannel } from "discordeno";

const previousVoiceStates = new Map<`${/*userId:*/ bigint}${/*guildId:*/ bigint}`, VoiceState>();

const service: ServiceStarter = ([client, bot]) => {
	extendEventHandler(bot, "voiceStateUpdate", { append: true }, (_, voiceState) => {
		if (!isServicing(client, voiceState.guildId)) {
			return;
		}

		onVoiceStateUpdate([client, bot], voiceState);
	});

	extendEventHandler(bot, "guildCreate", { append: true }, (_, { id: guildId }) => {
		if (!isServicing(client, guildId)) {
			return;
		}

		const guild = client.cache.guilds.get(guildId);
		if (guild === undefined) {
			return;
		}

		const voiceChannelStatesTuples = getVoiceChannelStatesTuples(guild);
		if (voiceChannelStatesTuples.length === 0) {
			return;
		}

		for (const [_, voiceStates] of voiceChannelStatesTuples) {
			for (const voiceState of voiceStates) {
				onVoiceStateUpdate([client, bot], voiceState);
			}
		}

		const freeChannels = voiceChannelStatesTuples
			.filter(([_, states]) => states.length === 0)
			.map(([channel]) => channel);
		// If there is up to one free channel already, do not process.
		if (freeChannels.length <= 1) {
			return;
		}

		const freeChannelIds = freeChannels.map((channel) => channel.id);

		freeChannelIds.splice(0, 1);

		for (const channelId of freeChannelIds) {
			deleteChannel(bot, channelId);
		}
	});
};

function onVoiceStateUpdate([client, bot]: [Client, Bot], voiceState: VoiceState): void {
	const guild = client.cache.guilds.get(voiceState.guildId);
	if (guild === undefined) {
		return;
	}

	const voiceChannelStatesTuples = getVoiceChannelStatesTuples(guild);
	if (voiceChannelStatesTuples.length === 0) {
		return;
	}

	const previousState = previousVoiceStates.get(`${voiceState.userId}${voiceState.guildId}`);

	if (previousState?.channelId === undefined) {
		onConnect([client, bot], guild, voiceChannelStatesTuples, voiceState);
	} else if (previousState.channelId !== undefined && voiceState.channelId === undefined) {
		onDisconnect([client, bot], voiceChannelStatesTuples, previousState);
	} else {
		onDisconnect([client, bot], voiceChannelStatesTuples, previousState);
		onConnect([client, bot], guild, voiceChannelStatesTuples, voiceState);
	}

	previousVoiceStates.set(`${voiceState.userId}${voiceState.guildId}`, voiceState);
}

type VoiceChannelStatesTuple = [channel: Channel, voiceStates: VoiceState[]];

async function onConnect(
	[client, bot]: [Client, Bot],
	guild: Guild,
	voiceChannelStatesTuples: VoiceChannelStatesTuple[],
	currentState: VoiceState,
): Promise<void> {
	const channelId = currentState.channelId;
	if (channelId === undefined) {
		return;
	}

	const tuple = voiceChannelStatesTuples.find(([channel, _states]) => channel.id === channelId);
	if (tuple === undefined) {
		return;
	}

	const [_, states] = tuple;

	// If somebody is already connected to the channel, do not process.
	if (states.length !== 1) {
		return;
	}

	const freeChannels = voiceChannelStatesTuples.filter(([_, states]) => states.length === 0).length;
	// If there is a free channel available already, do not process.
	if (freeChannels !== 0) {
		return;
	}

	// If the channel limit has already been reached, do not process.
	if (voiceChannelStatesTuples.length >= configuration.services.dynamicVoiceChannels.limit) {
		return;
	}

	const [firstChannel, __] = voiceChannelStatesTuples.at(0) ?? [];
	if (firstChannel === undefined) {
		return undefined;
	}

	createChannel(bot, guild.id, {
		name: configuration.guilds.channels.voiceChat,
		type: ChannelTypes.GuildVoice,
		parentId: firstChannel.parentId,
		position: voiceChannelStatesTuples.at(voiceChannelStatesTuples.length - 1)?.[0].position,
	}).catch(() => client.log.warn(`Failed to create voice channel on guild with ID ${guild.id}.`));
}

async function onDisconnect(
	[client, bot]: [Client, Bot],
	voiceChannelStatesTuples: VoiceChannelStatesTuple[],
	previousState: VoiceState,
): Promise<void> {
	const channelId = previousState.channelId;
	if (channelId === undefined) {
		return;
	}

	const voiceChannelStatesTuple = voiceChannelStatesTuples.find(([channel, _]) => channel.id === channelId);
	if (voiceChannelStatesTuple === undefined) {
		return;
	}

	const [_, states] = voiceChannelStatesTuple;
	// If somebody is still connected to the channel, do not process.
	if (states.length !== 0) {
		return;
	}

	const freeChannels = voiceChannelStatesTuples.filter(([_, states]) => states.length === 0);
	// If there is up to one free channel already, do not process.
	if (freeChannels.length <= 1) {
		return;
	}

	const lastFreeChannel = freeChannels.at(-1);
	if (lastFreeChannel === undefined) {
		return;
	}

	const [channelToDelete, __] = lastFreeChannel;

	deleteChannel(bot, channelToDelete.id).catch(() =>
		client.log.warn(`Failed to delete voice channel on guild with ID ${previousState.guildId}.`),
	);
}

function getVoiceChannelStatesTuples(guild: Guild): VoiceChannelStatesTuple[] {
	const voiceChannels = getRelevantVoiceChannels(guild);
	if (voiceChannels.length === 0) {
		return [];
	}

	const voiceStates = getRelevantVoiceStates(guild, [...voiceChannels.map((channel) => channel.id)]);

	return voiceChannels.map<[Channel, VoiceState[]]>((channel) => [channel, voiceStates.get(channel.id) ?? []]);
}

function getRelevantVoiceChannels(guild: Guild): Channel[] {
	const channels = guild.channels
		.filter((channel) => isVoice(channel) && channel.name === configuration.guilds.channels.voiceChat)
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

	return channels;
}

function getRelevantVoiceStates(guild: Guild, channelIds: bigint[]): Collection<bigint, VoiceState[]> {
	const voiceStates = guild.voiceStates.array().filter((voiceState) => voiceState.channelId !== undefined);
	return new Collection(
		channelIds.map((channelId) => [channelId, voiceStates.filter((voiceState) => voiceState.channelId === channelId)]),
	);
}

export default service;
