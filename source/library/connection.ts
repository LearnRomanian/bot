import type { DesiredProperties, DesiredPropertiesBehaviour } from "rost:constants/properties";
import type { Environment } from "rost:core/loaders/environment";
import type pino from "pino";

class DiscordConnection {
	readonly log: pino.Logger;
	readonly bot: Discord.Bot<DesiredProperties, DesiredPropertiesBehaviour>;

	constructor({
		log = constants.loggers.silent,
		environment,
		intents = Discord.Intents.Guilds |
			Discord.Intents.GuildMembers |
			Discord.Intents.GuildModeration |
			Discord.Intents.GuildVoiceStates |
			Discord.Intents.GuildMessages |
			Discord.Intents.MessageContent,
		eventHandlers = {},
		cacheHandlers = {},
	}: {
		log?: pino.Logger;
		environment: Environment;
		intents?: Discord.GatewayIntents;
		eventHandlers?: Partial<Discord.EventHandlers<DesiredProperties, DesiredPropertiesBehaviour>>;
		cacheHandlers?: Partial<Discord.Transformers<DesiredProperties, DesiredPropertiesBehaviour>["customizers"]>;
	}) {
		this.log = log.child({ name: "DiscordConnection" });
		this.bot = Discord.createBot<DesiredProperties, DesiredPropertiesBehaviour>({
			token: environment.discordSecret,
			intents,
			gateway: { cache: { requestMembers: { enabled: true } } },
			events: eventHandlers,
			transformers: { customizers: cacheHandlers },
			handlers: {
				// REMINDER(vxern): Remove this once Discordeno is able to filter out embeds being resolved in a message.
				MESSAGE_UPDATE: async (bot, data) => {
					const message = data.d as Discord.DiscordMessage;
					if (!message.author) {
						return;
					}

					// The `shardId` is not necessary here.
					bot.events.messageUpdate?.(bot.transformers.message(bot, { message, shardId: 0 }));
				},
			},
			desiredProperties: constants.properties as unknown as DesiredProperties,
			loggerFactory: (name) =>
				constants.loggers.discordeno.child({ name: name.toLowerCase() }, { level: "debug" }),
		});

		this.bot.rest.createBaseHeaders = () => ({ "User-Agent": constants.USER_AGENT });
	}

	async open(): Promise<void> {
		this.log.info("Establishing connection with the Discord gateway...");

		this.bot.start();

		this.log.info("A connection with the Discord gateway has been established.");
	}

	async close(): Promise<void> {
		this.log.info("Closing Discord gateway connection...");

		this.bot.shutdown();

		this.log.info("The connection with the Discord gateway has been closed.");
	}
}

export { DiscordConnection };
