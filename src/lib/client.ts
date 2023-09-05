import constants from "../constants/constants";
import languages, {
	LearningLanguage,
	Locale,
	LocalisationLanguage,
	getDiscordLocaleByLocalisationLanguage,
	getLocaleByLocalisationLanguage,
	getLocalisationLanguageByLocale,
	isDiscordLocalisationLanguage,
} from "../constants/languages";
import time from "../constants/time";
import defaults from "../defaults";
import { enableDesiredProperties, handleGuildMembersChunk, overrideDefaultEventHandlers } from "../fixes";
import { timestamp } from "../formatting";
import * as Logos from "../types";
import { Command, CommandTemplate, InteractionHandler, Option } from "./commands/command";
import commandTemplates from "./commands/commands";
import { SentencePair } from "./commands/language/commands/game";
import { isShowParameter } from "./commands/parameters";
import entryRequests from "./database/adapters/entry-requests";
import guilds from "./database/adapters/guilds";
import praises from "./database/adapters/praises";
import reports from "./database/adapters/reports";
import suggestions from "./database/adapters/suggestions";
import users from "./database/adapters/users";
import warnings from "./database/adapters/warnings";
import { Database } from "./database/database";
import { timeStructToMilliseconds } from "./database/structs/guild";
import diagnostics from "./diagnostics";
import {
	acknowledge,
	deleteReply,
	getCommandName,
	getLocaleData,
	isAutocomplete,
	reply,
	respond,
} from "./interactions";
import transformers from "./localisation/transformers";
import { AlertService } from "./services/alert/alert";
import { DynamicVoiceChannelService } from "./services/dynamic-voice-channels/dynamic-voice-channels";
import { EntryService } from "./services/entry/entry";
import { InteractionRepetitionService } from "./services/interaction-repetition/interaction-repetition";
import { JournallingService } from "./services/journalling/journalling";
import { LavalinkService } from "./services/music/lavalink";
import { MusicService } from "./services/music/music";
import { InformationNoticeService } from "./services/notices/types/information";
import { RoleNoticeService } from "./services/notices/types/roles";
import { WelcomeNoticeService } from "./services/notices/types/welcome";
import { ReportService } from "./services/prompts/types/reports";
import { SuggestionService } from "./services/prompts/types/suggestions";
import { VerificationService } from "./services/prompts/types/verification";
import { RealtimeUpdateService } from "./services/realtime-updates/service";
import { RoleIndicatorService } from "./services/role-indicators/role-indicators";
import { Service } from "./services/service";
import { StatusService } from "./services/status/service";
import { requestMembers } from "./utils";
import * as Discord from "@discordeno/bot";
import FancyLog from "fancy-log";
import Fauna from "fauna";

type Client = {
	environment: {
		version: string;
		discordSecret: string;
		faunaSecret: string;
		deeplSecret: string;
		rapidApiSecret: string;
		lavalinkHost: string;
		lavalinkPort: string;
		lavalinkPassword: string;
		loadSentences: boolean;
	};
	log: Logger;
	cache: {
		guilds: Map<bigint, Logos.Guild>;
		users: Map<bigint, Logos.User>;
		members: Map<bigint, Logos.Member>;
		channels: Map<bigint, Logos.Channel>;
		messages: {
			latest: Map<bigint, Logos.Message>;
			previous: Map<bigint, Logos.Message>;
		};
		interactions: Map<string, Logos.Interaction | Discord.Interaction>;
	};
	database: { log: Logger } & Database;
	commands: {
		commands: Record<keyof typeof commandTemplates, Command>;
		showable: string[];
		handlers: {
			execute: Map<string, InteractionHandler>;
			autocomplete: Map<string, InteractionHandler>;
		};
	};
	collectors: Map<Event, Set<Collector<Event>>>;
	features: {
		sentencePairs: Map<LearningLanguage, SentencePair[]>;
		// The keys are user IDs, the values are command usage timestamps mapped by command IDs.
		rateLimiting: Map<bigint, Map<bigint, number[]>>;
	};
	localisations: Map<string, Map<LocalisationLanguage, (args: Record<string, unknown>) => string>>;
	services: {
		global: Service[];
		local: Map<bigint, Service[]>;
	} & {
		alerts: Map<bigint, AlertService>;
		dynamicVoiceChannels: Map<bigint, DynamicVoiceChannelService>;
		entry: Map<bigint, EntryService>;
		journalling: Map<bigint, JournallingService>;
		music: {
			lavalink: LavalinkService;
			music: Map<bigint, MusicService>;
		};
		notices: {
			information: Map<bigint, InformationNoticeService>;
			roles: Map<bigint, RoleNoticeService>;
			welcome: Map<bigint, WelcomeNoticeService>;
		};
		prompts: {
			reports: Map<bigint, ReportService>;
			suggestions: Map<bigint, SuggestionService>;
			verification: Map<bigint, VerificationService>;
		};
		interactionRepetition: InteractionRepetitionService;
		realtimeUpdates: Map<bigint, RealtimeUpdateService>;
		roleIndicators: Map<bigint, RoleIndicatorService>;
		status: StatusService;
	};
};

interface Collector<ForEvent extends keyof Discord.EventHandlers> {
	filter: (...args: Parameters<Discord.EventHandlers[ForEvent]>) => boolean;
	limit?: number;
	removeAfter?: number;
	onCollect: (...args: Parameters<Discord.EventHandlers[ForEvent]>) => void;
	onEnd: () => void;
}

type Event = keyof Discord.EventHandlers;

type Logger = Record<"debug" | keyof typeof FancyLog, (...args: unknown[]) => void>;

function createClient(
	environment: Client["environment"],
	features: Client["features"],
	localisationsStatic: Map<string, Map<LocalisationLanguage, string>>,
): Client {
	const localisations = createLocalisations(localisationsStatic);

	const commands: Client["commands"] = buildCommands(commandTemplates, localisations);

	return {
		environment,
		log: createLogger("client"),
		cache: {
			guilds: new Map(),
			users: new Map(),
			members: new Map(),
			channels: new Map(),
			messages: {
				latest: new Map(),
				previous: new Map(),
			},
			interactions: new Map(),
		},
		database: {
			log: createLogger("database"),
			client: new Fauna.Client({
				secret: environment.faunaSecret,
				domain: "db.us.fauna.com",
				scheme: "https",
				port: 443,
			}),
			cache: {
				entryRequestBySubmitterAndGuild: new Map(),
				guildById: new Map(),
				praisesBySender: new Map(),
				praisesByRecipient: new Map(),
				reportsByAuthorAndGuild: new Map(),
				suggestionsByAuthorAndGuild: new Map(),
				usersByReference: new Map(),
				usersById: new Map(),
				warningsByRecipient: new Map(),
			},
			fetchPromises: {
				guilds: {
					id: new Map(),
				},
				praises: {
					recipient: new Map(),
					sender: new Map(),
				},
				users: {
					id: new Map(),
					reference: new Map(),
				},
				warnings: {
					recipient: new Map(),
				},
			},
			adapters: { entryRequests, guilds, reports, praises, suggestions, users, warnings },
		},
		commands,
		features,
		localisations,
		collectors: new Map(),
		services: {
			global: [],
			local: new Map(),
			alerts: new Map(),
			dynamicVoiceChannels: new Map(),
			entry: new Map(),
			journalling: new Map(),
			music: {
				// @ts-ignore: Late assignment.
				lavalink: "late_assignment",
				music: new Map(),
			},
			notices: {
				information: new Map(),
				roles: new Map(),
				welcome: new Map(),
			},
			prompts: {
				reports: new Map(),
				suggestions: new Map(),
				verification: new Map(),
			},
			// @ts-ignore: Late assignment.
			interactionRepetition: "late_assignment",
			realtimeUpdates: new Map(),
			roleIndicators: new Map(),
			// @ts-ignore: Late assignment.
			status: "late_assignment",
		},
	};
}

type LoggerType = "client" | "database";
function createLogger(type: LoggerType): Logger {
	let typeDisplayed: string;
	switch (type) {
		case "client": {
			typeDisplayed = "[CL]";
			break;
		}
		case "database": {
			typeDisplayed = "[DB]";
			break;
		}
	}
	return {
		debug: (...args: unknown[]) => {
			FancyLog.info(typeDisplayed, ...args);
		},
		info: (...args: unknown[]) => {
			FancyLog.info(typeDisplayed, ...args);
		},
		dir: (...args: unknown[]) => {
			FancyLog.dir(typeDisplayed, ...args);
		},
		error: (...args: unknown[]) => {
			FancyLog.error(typeDisplayed, ...args);
		},
		warn: (...args: unknown[]) => {
			FancyLog.warn(typeDisplayed, ...args);
		},
	};
}

async function dispatchGlobal<EventName extends keyof Discord.EventHandlers>(
	client: Client,
	eventName: EventName,
	{ args }: { args: Parameters<Discord.EventHandlers[EventName]> },
): Promise<void> {
	for (const service of client.services.global) {
		// @ts-ignore: This is fine.
		service[eventName](...args);
	}
}

async function dispatchLocal<EventName extends keyof Discord.EventHandlers>(
	client: Client,
	guildId: bigint,
	eventName: EventName,
	{ args }: { args: Parameters<Discord.EventHandlers[EventName]> },
): Promise<void> {
	const services = client.services.local.get(guildId);
	if (services === undefined) {
		return;
	}

	for (const service of services) {
		// @ts-ignore: This is fine.
		service[eventName](...args);
	}
}

async function dispatchEvent<EventName extends keyof Discord.EventHandlers>(
	client: Client,
	guildId: bigint | undefined,
	eventName: EventName,
	{ args }: { args: Parameters<Discord.EventHandlers[EventName]> },
): Promise<void> {
	dispatchGlobal(client, eventName, { args });

	if (guildId !== undefined) {
		dispatchLocal(client, guildId, eventName, { args });
	}
}

async function initialiseClient(
	environment: Client["environment"],
	features: Client["features"],
	localisations: Map<string, Map<LocalisationLanguage, string>>,
): Promise<void> {
	const client = createClient(environment, features, localisations);

	await prefetchDataFromDatabase(client, client.database);

	const bot = overrideDefaultEventHandlers(
		Discord.createBot({
			token: environment.discordSecret,
			intents:
				Discord.Intents.Guilds |
				Discord.Intents.GuildMembers | // Members joining, leaving, changing.
				Discord.Intents.GuildModeration | // Access to audit log.
				Discord.Intents.GuildVoiceStates |
				Discord.Intents.GuildMessages |
				Discord.Intents.MessageContent,
			events: {
				async ready(...args) {
					dispatchGlobal(client, "ready", { args });
				},
				async interactionCreate(interaction) {
					await handleInteractionCreate([client, bot], interaction);

					dispatchEvent(client, interaction.guildId, "interactionCreate", { args: [interaction] });
				},
				async guildMemberAdd(member, user) {
					dispatchEvent(client, member.guildId, "guildMemberAdd", { args: [member, user] });
				},
				async guildMemberRemove(user, guildId) {
					dispatchEvent(client, guildId, "guildMemberRemove", { args: [user, guildId] });
				},
				async guildMemberUpdate(member, user) {
					dispatchEvent(client, member.guildId, "guildMemberUpdate", { args: [member, user] });
				},
				async messageCreate(message) {
					dispatchEvent(client, message.guildId, "messageCreate", { args: [message] });
				},
				async messageDelete(payload, message) {
					dispatchEvent(client, payload.guildId, "messageDelete", { args: [payload, message] });
				},
				async messageDeleteBulk(payload) {
					dispatchEvent(client, payload.guildId, "messageDeleteBulk", { args: [payload] });
				},
				async messageUpdate(message, oldMessage) {
					dispatchEvent(client, message.guildId, "messageUpdate", { args: [message, oldMessage] });
				},
				async voiceServerUpdate(payload) {
					dispatchEvent(client, payload.guildId, "voiceServerUpdate", { args: [payload] });
				},
				async voiceStateUpdate(voiceState) {
					dispatchEvent(client, voiceState.guildId, "voiceStateUpdate", { args: [voiceState] });
				},
				async channelCreate(channel) {
					dispatchEvent(client, channel.guildId, "channelCreate", { args: [channel] });
				},
				async channelDelete(channel) {
					client.cache.channels.delete(channel.id);

					if (channel.guildId !== undefined) {
						client.cache.guilds.get(channel.guildId)?.channels.delete(channel.id);
					}

					dispatchEvent(client, channel.guildId, "channelDelete", { args: [channel] });
				},
				async channelPinsUpdate(data) {
					dispatchEvent(client, data.guildId, "channelPinsUpdate", { args: [data] });
				},
				async channelUpdate(channel) {
					dispatchEvent(client, channel.guildId, "channelUpdate", { args: [channel] });
				},
				async guildEmojisUpdate(payload) {
					dispatchEvent(client, payload.guildId, "guildEmojisUpdate", { args: [payload] });
				},
				async guildBanAdd(user, guildId) {
					dispatchEvent(client, guildId, "guildBanAdd", { args: [user, guildId] });
				},
				async guildBanRemove(user, guildId) {
					dispatchEvent(client, guildId, "guildBanRemove", { args: [user, guildId] });
				},
				async guildCreate(guild) {
					await handleGuildCreate([client, bot], guild);

					dispatchEvent(client, guild.id, "guildCreate", { args: [guild] });
				},
				async guildDelete(id, shardId) {
					await handleGuildDelete(client, id);

					dispatchEvent(client, id, "guildDelete", { args: [id, shardId] });
				},
				async guildUpdate(guild) {
					dispatchEvent(client, guild.id, "guildUpdate", { args: [guild] });
				},
				async roleCreate(role) {
					dispatchEvent(client, role.guildId, "roleCreate", { args: [role] });
				},
				async roleDelete(role) {
					dispatchEvent(client, role.guildId, "roleDelete", { args: [role] });
				},
				async roleUpdate(role) {
					dispatchEvent(client, role.guildId, "roleUpdate", { args: [role] });
				},
			},
		}),
	);

	bot.transformers.desiredProperties = enableDesiredProperties(
		bot.transformers.desiredProperties,
	) as Discord.Transformers["desiredProperties"];
	bot.handlers.GUILD_MEMBERS_CHUNK = handleGuildMembersChunk;
	bot.gateway.cache.requestMembers = { enabled: true, pending: new Discord.Collection() };
	bot.transformers = withCaching(client, bot.transformers);

	const promises: Promise<unknown>[] = [];

	const lavalinkService = new LavalinkService([client, bot]);
	client.services.global.push(lavalinkService);
	client.services.music.lavalink = lavalinkService;
	promises.push(lavalinkService.start());

	const interactionRepetitionService = new InteractionRepetitionService([client, bot]);
	client.services.global.push(interactionRepetitionService);
	client.services.interactionRepetition = interactionRepetitionService;
	promises.push(interactionRepetitionService.start());

	promises.push(bot.start());

	await Promise.all(promises);

	const statusService = new StatusService([client, bot]);
	client.services.global.push(statusService);
	client.services.status = statusService;
	await statusService.start();
}

async function prefetchDataFromDatabase(client: Client, database: Database): Promise<void> {
	await Promise.all([
		database.adapters.entryRequests.prefetch(client),
		database.adapters.reports.prefetch(client),
		database.adapters.suggestions.prefetch(client),
	]);
}

export async function handleGuildCreate(
	[client, bot]: [Client, Discord.Bot],
	guild: Discord.Guild | Logos.Guild,
	options: { isUpdate: boolean } = { isUpdate: false },
): Promise<void> {
	if (!options.isUpdate) {
		client.log.info(`Logos added to "${guild.name}" (ID ${guild.id}).`);
	}

	const guildDocument = await client.database.adapters.guilds.getOrFetchOrCreate(
		client,
		"id",
		guild.id.toString(),
		guild.id,
	);
	if (guildDocument === undefined) {
		return;
	}

	const configuration = guildDocument.data;

	const commands = client.commands.commands;

	const guildCommands: Command[] = [commands.information, commands.credits, commands.licence, commands.settings];
	const services: Service[] = [];

	// const realtimeUpdateService = new RealtimeUpdateService([client, bot], guild.id, guildDocument.ref);
	// services.push(realtimeUpdateService);

	// client.services.realtimeUpdates.set(guild.id, realtimeUpdateService);

	if (configuration.features.information.enabled) {
		const information = configuration.features.information.features;

		if (information.journaling.enabled) {
			const service = new JournallingService([client, bot], guild.id);
			services.push(service);

			client.services.journalling.set(guild.id, service);
		}

		if (information.notices.enabled) {
			const notices = information.notices.features;

			if (notices.information.enabled) {
				const service = new InformationNoticeService([client, bot], guild.id);
				services.push(service);

				client.services.notices.information.set(guild.id, service);
			}

			if (notices.roles.enabled) {
				const service = new RoleNoticeService([client, bot], guild.id);
				services.push(service);

				client.services.notices.roles.set(guild.id, service);
			}

			if (notices.welcome.enabled) {
				const service = new WelcomeNoticeService([client, bot], guild.id);
				services.push(service);

				client.services.notices.welcome.set(guild.id, service);
			}
		}
	}

	if (configuration.features.language.enabled) {
		const language = configuration.features.language.features;

		if (language.answers?.enabled) {
			guildCommands.push(commands.answer);
		}

		if (language.corrections?.enabled) {
			guildCommands.push(commands.correctionFull, commands.correctionPartial);
		}

		if (language.cefr?.enabled) {
			guildCommands.push(commands.cefr);
		}

		if (language.game.enabled) {
			guildCommands.push(commands.game);
		}

		if (language.resources.enabled) {
			guildCommands.push(commands.resources);
		}

		if (language.translate.enabled) {
			guildCommands.push(commands.detectLanguageChatInput, commands.detectLanguageMessage);
			guildCommands.push(commands.translate);
		}

		if (language.word.enabled) {
			guildCommands.push(commands.word);
		}
	}

	if (configuration.features.moderation.enabled) {
		guildCommands.push(commands.list);

		const moderation = configuration.features.moderation.features;

		if (moderation.alerts.enabled) {
			const service = new AlertService([client, bot], guild.id);
			services.push(service);

			client.services.alerts.set(guild.id, service);
		}

		if (moderation.policy.enabled) {
			guildCommands.push(commands.policy);
		}

		if (moderation.rules.enabled) {
			guildCommands.push(commands.rule);
		}

		if (moderation.slowmode?.enabled) {
			guildCommands.push(commands.slowmode);
		}

		if (moderation.timeouts.enabled) {
			guildCommands.push(commands.timeout);
		}

		if (moderation.purging.enabled) {
			guildCommands.push(commands.purge);
		}

		if (moderation.warns.enabled) {
			guildCommands.push(commands.warn, commands.pardon);
		}

		if (moderation.reports.enabled) {
			guildCommands.push(commands.report);

			const service = new ReportService([client, bot], guild.id);
			services.push(service);

			client.services.prompts.reports.set(guild.id, service);
		}

		if (moderation.verification.enabled) {
			const service = new VerificationService([client, bot], guild.id);
			services.push(service);

			client.services.prompts.verification.set(guild.id, service);
		}
	}

	if (configuration.features.server.enabled) {
		const server = configuration.features.server.features;

		if (server.dynamicVoiceChannels.enabled) {
			const service = new DynamicVoiceChannelService([client, bot], guild.id);
			services.push(service);

			client.services.dynamicVoiceChannels.set(guild.id, service);
		}

		if (server.entry.enabled) {
			const service = new EntryService([client, bot], guild.id);
			services.push(service);

			client.services.entry.set(guild.id, service);
		}

		if (server.roleIndicators?.enabled) {
			const service = new RoleIndicatorService([client, bot], guild.id);
			services.push(service);

			client.services.roleIndicators.set(guild.id, service);
		}

		if (server.suggestions.enabled) {
			guildCommands.push(commands.suggestion);

			const service = new SuggestionService([client, bot], guild.id);
			services.push(service);

			client.services.prompts.suggestions.set(guild.id, service);
		}
	}

	if (configuration.features.social.enabled) {
		const social = configuration.features.social.features;

		if (social.music.enabled) {
			guildCommands.push(commands.music);

			const service = new MusicService([client, bot], guild.id);
			services.push(service);

			client.services.music.music.set(guild.id, service);
		}

		if (social.praises.enabled) {
			guildCommands.push(commands.praise);
		}

		if (social.profile.enabled) {
			guildCommands.push(commands.profile);
		}
	}

	await bot.rest
		.upsertGuildApplicationCommands(guild.id, guildCommands)
		.catch((reason) => client.log.warn(`Failed to upsert commands on ${diagnostics.display.guild(guild)}:`, reason));

	if (!options.isUpdate) {
		client.log.info(`Fetching ~${guild.memberCount} members of ${diagnostics.display.guild(guild)}...`);

		await requestMembers(bot, guild.id, { limit: 0, query: "" }).catch((reason) =>
			client.log.warn(`Failed to fetch members of ${diagnostics.display.guild(guild)}:`, reason),
		);

		client.log.info(`Fetched ~${guild.memberCount} members of ${diagnostics.display.guild(guild)}.`);
	}

	client.log.info(`Starting ${services.length} service(s) on ${diagnostics.display.guild(guild)}...`);
	const promises = [];
	for (const service of services) {
		promises.push(service.start());
	}
	Promise.all(promises).then((_) => {
		client.log.info(`Services started on ${diagnostics.display.guild(guild)}.`);
	});

	client.services.local.set(guild.id, services);
}

export async function handleGuildDelete(client: Client, guildId: bigint): Promise<void> {
	const guild = client.cache.guilds.get(guildId);
	if (guild === undefined) {
		return undefined;
	}

	const runningServices = client.services.local.get(guild.id) ?? [];
	client.services.local.delete(guild.id);
	for (const runningService of runningServices) {
		runningService.stop();
	}
}

async function handleInteractionCreate(
	[client, bot]: [Client, Discord.Bot],
	interactionRaw: Discord.Interaction,
	flags?: Logos.InteractionFlags,
): Promise<void> {
	if (interactionRaw.data?.customId === constants.components.none) {
		acknowledge([client, bot], interactionRaw);
		return;
	}

	const commandName = getCommandName(interactionRaw);
	if (commandName === undefined) {
		return;
	}

	const localeData = await getLocaleData(client, interactionRaw);
	const interaction: Logos.Interaction = { ...interactionRaw, ...localeData, ...(flags !== undefined ? flags : {}) };

	let handle: InteractionHandler | undefined;
	if (isAutocomplete(interactionRaw)) {
		handle = client.commands.handlers.autocomplete.get(commandName);
	} else {
		handle = client.commands.handlers.execute.get(commandName);
	}
	if (handle === undefined) {
		return;
	}

	try {
		await handle([client, bot], interaction);
	} catch (exception) {
		client.log.error(exception);
	}
}

function withCaching(client: Client, transformers: Discord.Transformers): Discord.Transformers {
	const { guild, channel, user, member, message, role, voiceState } = transformers;

	transformers.guild = (bot, payload) => {
		const resultUnoptimised = guild(bot, payload);
		const result = Logos.slimGuild(resultUnoptimised);

		for (const channel of payload.guild.channels ?? []) {
			bot.transformers.channel(bot, { channel, guildId: result.id });
		}

		client.cache.guilds.set(result.id, result);

		return resultUnoptimised;
	};

	transformers.channel = (...args) => {
		const resultUnoptimised = channel(...args);
		const result = Logos.slimChannel(resultUnoptimised);

		client.cache.channels.set(result.id, result);

		if (result.guildId !== undefined) {
			client.cache.guilds.get(result.guildId)?.channels.set(result.id, result);
		}

		return resultUnoptimised;
	};

	transformers.user = (...args) => {
		const resultUnoptimised = user(...args);
		const result = Logos.slimUser(resultUnoptimised);

		client.cache.users.set(result.id, result);

		return resultUnoptimised;
	};

	transformers.member = (bot, payload, guildId, userId) => {
		const resultUnoptimised = member(bot, payload, guildId, userId);
		const result = Logos.slimMember(resultUnoptimised);

		const memberSnowflake = bot.transformers.snowflake(`${userId}${guildId}`);

		client.cache.members.set(memberSnowflake, result);

		client.cache.guilds.get(BigInt(guildId))?.members.set(BigInt(userId), result);

		return resultUnoptimised;
	};

	transformers.message = (bot, payload) => {
		const resultUnoptimised = message(bot, payload);
		const result = Logos.slimMessage(resultUnoptimised);

		const previousMessage = client.cache.messages.latest.get(result.id);
		if (previousMessage !== undefined) {
			client.cache.messages.previous.set(result.id, previousMessage);
		}

		client.cache.messages.latest.set(result.id, result);

		const user = bot.transformers.user(bot, payload.author);

		client.cache.users.set(user.id, user);

		if (payload.member !== undefined && payload.guild_id !== undefined) {
			const guildId = bot.transformers.snowflake(payload.guild_id);

			const member = bot.transformers.member(bot, { ...payload.member, user: payload.author }, guildId, user.id);

			const memberSnowflake = bot.transformers.snowflake(`${member.id}${member.guildId}`);

			client.cache.members.set(memberSnowflake, member);
		}

		return resultUnoptimised;
	};

	transformers.role = (bot, payload) => {
		const resultUnoptimised = role(bot, payload);
		const result = Logos.slimRole(resultUnoptimised);

		client.cache.guilds.get(result.guildId)?.roles.set(result.id, result);

		return resultUnoptimised;
	};

	transformers.voiceState = (bot, payload) => {
		const resultUnoptimised = voiceState(bot, payload);
		const result = Logos.slimVoiceState(resultUnoptimised);

		if (result.channelId !== undefined) {
			client.cache.guilds.get(result.guildId)?.voiceStates.set(result.userId, result);
		} else {
			client.cache.guilds.get(result.guildId)?.voiceStates.delete(result.userId);
		}

		return resultUnoptimised;
	};

	return transformers;
}

function withRateLimiting(handle: InteractionHandler): InteractionHandler {
	return async ([client, bot], interaction) => {
		if (isAutocomplete(interaction)) {
			return;
		}

		const locale = interaction.locale;

		const commandId = interaction.data?.id;
		if (commandId === undefined) {
			return handle([client, bot], interaction);
		}

		const executedAt = Date.now();

		const rateLimitIntervalMilliseconds = timeStructToMilliseconds(defaults.RATE_LIMIT_INTERVAL);
		const timestampsByCommandId = client.features.rateLimiting.get(interaction.user.id) ?? new Map();
		const timestamps = [...(timestampsByCommandId.get(commandId) ?? []), executedAt];
		const activeTimestamps = timestamps.filter((timestamp) => Date.now() - timestamp <= rateLimitIntervalMilliseconds);

		if (activeTimestamps.length > defaults.RATE_LIMIT) {
			const firstTimestamp = activeTimestamps.at(0);
			if (firstTimestamp) {
				throw "StateError: Unexpected undefined initial timestamp.";
			}

			const now = Date.now();

			const nextValidUsageTimestamp = now + rateLimitIntervalMilliseconds - (now - firstTimestamp);
			const nextValidUsageTimestampFormatted = timestamp(nextValidUsageTimestamp);

			const strings = {
				title: localise(client, "interactions.rateLimited.title", locale)(),
				description: {
					tooManyUses: localise(
						client,
						"interactions.rateLimited.description.tooManyUses",
						locale,
					)({ times: defaults.RATE_LIMIT }),
					cannotUseUntil: localise(
						client,
						"interactions.rateLimited.description.cannotUseAgainUntil",
						locale,
					)({ relative_timestamp: nextValidUsageTimestampFormatted }),
				},
			};

			setTimeout(() => deleteReply([client, bot], interaction), nextValidUsageTimestamp - now - time.second);

			reply([client, bot], interaction, {
				embeds: [
					{
						title: strings.title,
						description: `${strings.description.tooManyUses}\n\n${strings.description.cannotUseUntil}`,
						color: constants.colors.dullYellow,
					},
				],
			});
			return;
		}

		timestampsByCommandId.set(commandId, activeTimestamps);

		return handle([client, bot], interaction);
	};
}

function buildCommands<
	CommandTemplates extends Record<keyof typeof commandTemplates, CommandTemplate>,
	CommandName extends keyof CommandTemplates,
>(templates: CommandTemplates, localisations: Client["localisations"]): Client["commands"] {
	function localiseCommandOrOption(key: string, type?: CommandTemplate["type"]): Partial<Command> | undefined {
		const optionName = key.split(".")?.at(-1);
		if (optionName === undefined) {
			console.warn(`Failed to get option name from localisation key '${key}'.`);
			return undefined;
		}

		const nameLocalisationsAll = localisations.get(`${key}.name`) ?? localisations.get(`parameters.${optionName}.name`);
		const name = nameLocalisationsAll?.get(defaults.LOCALISATION_LANGUAGE)?.({});
		if (name === undefined) {
			console.warn(`Failed to get command name from localisation key '${key}'.`);
			return undefined;
		}

		const nameLocalisations = nameLocalisationsAll !== undefined ? toDiscordLocalisations(nameLocalisationsAll) : {};
		for (const locale of languages.locales.discord) {
			if (locale in nameLocalisations) {
				continue;
			}

			nameLocalisations[locale] = name;
		}

		if (type === Discord.ApplicationCommandTypes.Message) {
			return {
				name,
				nameLocalizations: nameLocalisations ?? {},
			};
		}

		const descriptionLocalisationsAll =
			localisations.get(`${key}.description`) ?? localisations.get(`parameters.${optionName}.description`);
		const description = descriptionLocalisationsAll?.get(defaults.LOCALISATION_LANGUAGE)?.({});
		const descriptionLocalisations =
			descriptionLocalisationsAll !== undefined ? toDiscordLocalisations(descriptionLocalisationsAll) : undefined;

		return {
			name,
			nameLocalizations: nameLocalisations ?? {},
			description:
				description ??
				localisations.get("noDescription")?.get(defaults.LOCALISATION_LANGUAGE)?.({}) ??
				"No description.",
			descriptionLocalizations: descriptionLocalisations ?? {},
		};
	}

	const showable: string[] = [];

	const commandBuffer: Partial<Record<CommandName, Command>> = {};
	for (const [commandName, commandRaw] of Object.entries(templates) as [CommandName, CommandTemplate][]) {
		const commandKey = commandRaw.name;
		const localisations = localiseCommandOrOption(commandKey, commandRaw.type);
		if (localisations === undefined) {
			continue;
		}

		const command: Command = { ...commandRaw, ...localisations, options: [] } as Command;

		for (const optionTemplate of commandRaw.options ?? []) {
			if (isShowParameter(optionTemplate)) {
				showable.push(`${command.name}`);
			}

			const optionKey = [commandKey, "options", optionTemplate.name].join(".");
			const localisations = localiseCommandOrOption(optionKey);
			if (localisations === undefined) {
				continue;
			}

			const option: Option = { ...optionTemplate, ...localisations, options: [] } as Option;

			for (const subOptionTemplate of optionTemplate.options ?? []) {
				if (isShowParameter(subOptionTemplate)) {
					showable.push(`${command.name} ${option.name}`);
				}

				const subOptionKey = [optionKey, "options", subOptionTemplate.name].join(".");
				const localisations = localiseCommandOrOption(subOptionKey);
				if (localisations === undefined) {
					continue;
				}

				const subOption: Option = { ...subOptionTemplate, ...localisations, options: [] } as Option;

				for (const subSubOptionTemplate of subOptionTemplate.options ?? []) {
					if (isShowParameter(subSubOptionTemplate)) {
						showable.push(`${command.name} ${option.name} ${subOption.name}`);
					}

					const subSubOptionKey = [subOptionKey, "options", subSubOptionTemplate.name].join(".");
					const localisations = localiseCommandOrOption(subSubOptionKey);
					if (localisations === undefined) {
						continue;
					}

					const subSubOption: Option = { ...subSubOptionTemplate, ...localisations, options: [] } as Option;

					subOption.options?.push(subSubOption);
				}

				option.options?.push(subOption);
			}

			(command as Discord.CreateSlashApplicationCommand).options?.push(option);
		}

		commandBuffer[commandName] = command;
	}

	const commands = commandBuffer as Record<keyof typeof commandTemplates, Command>;
	const handlers = createCommandHandlers(Object.values(commands) as CommandTemplate[]);

	return { commands, showable, handlers };
}

function createCommandHandlers(commands: CommandTemplate[]): Client["commands"]["handlers"] {
	const handlers = new Map<string, InteractionHandler>();
	const autocompleteHandlers = new Map<string, InteractionHandler>();

	for (const command of commands) {
		if (command.handle !== undefined) {
			handlers.set(command.name, command.isRateLimited ? withRateLimiting(command.handle) : command.handle);
		}

		if (command.handleAutocomplete !== undefined) {
			autocompleteHandlers.set(command.name, command.handleAutocomplete);
		}

		if (command.options === undefined) {
			continue;
		}

		for (const option of command.options) {
			if (option.handle !== undefined) {
				handlers.set(
					`${command.name} ${option.name}`,
					command.isRateLimited || option.isRateLimited ? withRateLimiting(option.handle) : option.handle,
				);
			}

			if (option.handleAutocomplete !== undefined) {
				autocompleteHandlers.set(`${command.name} ${option.name}`, option.handleAutocomplete);
			}

			if (option.options === undefined) {
				continue;
			}

			for (const subOption of option.options) {
				if (subOption.handle !== undefined) {
					handlers.set(
						`${command.name} ${option.name} ${subOption.name}`,
						command.isRateLimited || option.isRateLimited || subOption.isRateLimited
							? withRateLimiting(subOption.handle)
							: subOption.handle,
					);
				}

				if (subOption.handleAutocomplete !== undefined) {
					autocompleteHandlers.set(`${command.name} ${option.name} ${subOption.name}`, subOption.handleAutocomplete);
				}
			}
		}
	}

	return { execute: handlers, autocomplete: autocompleteHandlers };
}

function addCollector<T extends keyof Discord.EventHandlers>(
	[client, bot]: [Client, Discord.Bot],
	event: T,
	collector: Collector<T>,
): void {
	const onEnd = collector.onEnd;
	collector.onEnd = () => {
		collectors?.delete(collector);
		onEnd();
	};

	if (collector.limit !== undefined) {
		let emitCount = 0;
		const onCollect = collector.onCollect;
		collector.onCollect = (...args) => {
			emitCount++;

			if (emitCount === collector.limit) {
				collector.onEnd();
			}

			onCollect(...args);
		};
	}

	const { removeAfter } = collector;
	if (removeAfter !== undefined) {
		setTimeout(collector.onEnd, removeAfter);
	}

	if (!client.collectors.has(event)) {
		const collectors: Set<Collector<keyof Discord.EventHandlers>> = new Set();
		client.collectors.set(event, collectors);

		extendEventHandler(bot, event, { prepend: true }, (...args) => {
			for (const collector of collectors) {
				if (!collector.filter(...args)) {
					continue;
				}

				collector.onCollect(...args);
			}
		});
	}

	const collectors = client.collectors.get(event);
	if (collectors === undefined) {
		return;
	}

	collectors.add(collector);
}

const snowflakePattern = new RegExp(/^([0-9]{16,20})$/);
const userMentionPattern = new RegExp(/^<@!?([0-9]{16,20})>$/);

function isValidSnowflake(snowflake: string): boolean {
	return snowflakePattern.test(snowflake);
}

function extractIDFromIdentifier(identifier: string): string | undefined {
	return (
		snowflakePattern.exec(identifier)?.at(1) ??
		displayPattern.exec(identifier)?.at(1) ??
		userMentionPattern.exec(identifier)?.at(1)
	);
}

const displayPattern = new RegExp(/^.*?\(?([0-9]{16,20})\)?$/);
const oldUserTagPattern = new RegExp(/^([^@](?:.{1,31})?#(?:[0-9]{4}|0))$/);
const userTagPattern = new RegExp(/^(@?.{2,32})$/);

function isValidIdentifier(identifier: string): boolean {
	return (
		snowflakePattern.test(identifier) ||
		userMentionPattern.test(identifier) ||
		displayPattern.test(identifier) ||
		oldUserTagPattern.test(identifier) ||
		userTagPattern.test(identifier)
	);
}

interface MemberNarrowingOptions {
	includeBots: boolean;
	restrictToSelf: boolean;
	restrictToNonSelf: boolean;
	excludeModerators: boolean;
}

function resolveIdentifierToMembers(
	client: Client,
	guildId: bigint,
	userId: bigint,
	identifier: string,
	options: Partial<MemberNarrowingOptions> = {},
): [members: Logos.Member[], isResolved: boolean] | undefined {
	const asker = client.cache.members.get(Discord.snowflakeToBigint(`${userId}${guildId}`));
	if (asker === undefined) {
		return undefined;
	}

	const guild = client.cache.guilds.get(guildId);
	if (guild === undefined) {
		return undefined;
	}

	const moderatorRoleIds = guild.roles
		.array()
		.filter((role) => role.permissions.has("MODERATE_MEMBERS"))
		.map((role) => role.id);
	if (moderatorRoleIds.length === 0) {
		return undefined;
	}

	const id = extractIDFromIdentifier(identifier);
	if (id !== undefined) {
		const member = client.cache.members.get(Discord.snowflakeToBigint(`${id}${guildId}`));
		if (member === undefined) {
			return undefined;
		}

		if (options.restrictToSelf && member.id !== asker.id) {
			return undefined;
		}

		if (options.restrictToNonSelf && member.id === asker.id) {
			return undefined;
		}

		if (options.excludeModerators && moderatorRoleIds.some((roleId) => member.roles.includes(roleId))) {
			return undefined;
		}

		return [[member], true];
	}

	const cachedMembers = options.restrictToSelf ? [asker] : guild.members.array();
	const members = cachedMembers.filter(
		(member) =>
			(options.restrictToNonSelf ? member.user?.id !== asker.user?.id : true) &&
			(options.excludeModerators ? !moderatorRoleIds.some((roleId) => member.roles.includes(roleId)) : true),
	);

	if (oldUserTagPattern.test(identifier)) {
		const identifierLowercase = identifier.toLowerCase();
		const member = members.find(
			(member) =>
				member.user !== undefined &&
				`${member.user.username.toLowerCase()}#${member.user.discriminator}`.includes(identifierLowercase),
		);
		if (member === undefined) {
			return [[], false];
		}

		return [[member], true];
	}

	if (userTagPattern.test(identifier)) {
		const identifierLowercase = identifier.toLowerCase();
		const member = members.find((member) => member.user?.username?.toLowerCase().includes(identifierLowercase));
		if (member === undefined) {
			return [[], false];
		}

		return [[member], true];
	}

	const identifierLowercase = identifier.toLowerCase();
	const matchedMembers = members.filter((member) => {
		if (member.user?.toggles?.has("bot") && !options.includeBots) {
			return false;
		}
		if (
			member.user &&
			`${member.user.username.toLowerCase()}#${member.user.discriminator}`.includes(identifierLowercase)
		) {
			return true;
		}
		if (member.user?.username.toLowerCase().includes(identifierLowercase)) {
			return true;
		}
		if (member.nick?.toLowerCase().includes(identifierLowercase)) {
			return true;
		}
		return false;
	});

	return [matchedMembers, false];
}

async function autocompleteMembers(
	[client, bot]: [Client, Discord.Bot],
	interaction: Logos.Interaction,
	identifier: string,
	options?: Partial<MemberNarrowingOptions>,
): Promise<void> {
	const guildId = interaction.guildId;
	if (guildId === undefined) {
		return undefined;
	}

	const result = resolveIdentifierToMembers(client, guildId, interaction.user.id, identifier, options);
	if (result === undefined) {
		return;
	}

	const [matchedMembers, _] = result;

	const users: Logos.User[] = [];
	for (const member of matchedMembers) {
		if (users.length === 20) {
			break;
		}

		const user = member.user;
		if (user === undefined) {
			continue;
		}

		users.push(user);
	}

	respond(
		[client, bot],
		interaction,
		users.map((user) => ({ name: diagnostics.display.user(user, { prettify: true }), value: user.id.toString() })),
	);
}

function resolveInteractionToMember(
	[client, bot]: [Client, Discord.Bot],
	interaction: Logos.Interaction,
	identifier: string,
	options: Partial<MemberNarrowingOptions>,
	{ locale }: { locale: Locale },
): Logos.Member | undefined {
	const guildId = interaction.guildId;
	if (guildId === undefined) {
		return undefined;
	}

	const result = resolveIdentifierToMembers(client, guildId, interaction.user.id, identifier, options);
	if (result === undefined) {
		return;
	}

	const [matchedMembers, isResolved] = result;
	if (isResolved) {
		return matchedMembers.at(0);
	}

	if (matchedMembers.length === 0) {
		const strings = {
			title: localise(client, "interactions.invalidUser.title", locale)(),
			description: localise(client, "interactions.invalidUser.description", locale)(),
		};

		reply([client, bot], interaction, {
			embeds: [
				{
					title: strings.title,
					description: strings.description,
					color: constants.colors.red,
				},
			],
		});

		return undefined;
	}

	return matchedMembers.at(0);
}

function extendEventHandler<Event extends keyof Discord.EventHandlers, Handler extends Discord.EventHandlers[Event]>(
	bot: Discord.Bot,
	eventName: Event,
	{ prepend = false, append = false }: { prepend: true; append?: false } | { prepend?: false; append: true },
	extension: (...args: Parameters<Handler>) => unknown,
): void {
	const events = bot.events;

	const handler = events[eventName] as (...args: Parameters<Handler>) => unknown;
	events[eventName] = (
		prepend || !append
			? (...args: Parameters<Handler>) => {
					extension(...args);
					handler(...args);
			  }
			: (...args: Parameters<Handler>) => {
					handler(...args);
					extension(...args);
			  }
	) as Handler;
}

function createLocalisations(
	localisationsRaw: Map<string, Map<LocalisationLanguage, string>>,
): Client["localisations"] {
	const processLocalisation = (localisation: string, args: Record<string, unknown>) => {
		let result = localisation;
		for (const [key, value] of Object.entries(args)) {
			result = result.replaceAll(`{${key}}`, `${value}`);
		}
		return result;
	};

	const localisations = new Map<string, Map<LocalisationLanguage, (args: Record<string, unknown>) => string>>();
	for (const [key, languages] of localisationsRaw.entries()) {
		const functions = new Map<LocalisationLanguage, (args: Record<string, unknown>) => string>();

		for (const [language, string] of languages.entries()) {
			functions.set(language, (args: Record<string, unknown>) => processLocalisation(string, args));
		}

		localisations.set(key, functions);
	}

	return localisations;
}

function localise(client: Client, key: string, locale: Locale | undefined): (args?: Record<string, unknown>) => string {
	const language =
		(locale !== undefined ? getLocalisationLanguageByLocale(locale) : undefined) ?? defaults.LOCALISATION_LANGUAGE;

	const getLocalisation =
		client.localisations.get(key)?.get(language) ??
		client.localisations.get(key)?.get(defaults.LOCALISATION_LANGUAGE) ??
		(() => key);

	return (args) => {
		const string = getLocalisation(args ?? {});
		if (language !== defaults.LOCALISATION_LANGUAGE && string.trim().length === 0) {
			return localise(client, key, undefined)(args ?? {});
		}

		return string;
	};
}

function toDiscordLocalisations(
	localisations: Map<LocalisationLanguage, (args: Record<string, unknown>) => string>,
): Discord.Localization {
	const entries = Array.from(localisations.entries());
	const result: Discord.Localization = {};
	for (const [language, localise] of entries) {
		if (!isDiscordLocalisationLanguage(language)) {
			continue;
		}

		const locale = getDiscordLocaleByLocalisationLanguage(language);
		if (locale === undefined) {
			continue;
		}

		const string = localise({});
		if (string.length === 0) {
			continue;
		}

		result[locale] = string;
	}
	return result;
}

function pluralise(client: Client, key: string, language: LocalisationLanguage, number: number): string {
	const locale = getLocaleByLocalisationLanguage(language);
	const pluralise = transformers[language].pluralise;
	const { one, two, many } = {
		one: localise(client, `${key}.one`, locale)?.({ one: number }),
		two: localise(client, `${key}.two`, locale)?.({ two: number }),
		many: localise(client, `${key}.many`, locale)?.({ many: number }),
	};

	const pluralised = pluralise(`${number}`, { one, two, many });
	if (pluralised === undefined) {
		return "?";
	}

	return pluralised;
}

export {
	addCollector,
	autocompleteMembers,
	extendEventHandler,
	initialiseClient,
	isValidIdentifier,
	isValidSnowflake,
	localise,
	resolveIdentifierToMembers,
	handleInteractionCreate,
	resolveInteractionToMember,
	pluralise,
};
export type { Client, Collector };
