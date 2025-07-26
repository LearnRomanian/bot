import { loadEnvironment } from "rost:core/loaders/environment";
import { getAvailableMigrations, migrate } from "rost:core/runners/migrator";
import { DiscordConnection } from "rost/connection";
import { DatabaseMetadata } from "rost/models/database-metadata";
import { Guild } from "rost/models/guild";
import { CacheStore } from "rost/stores/cache";
import { DatabaseStore } from "rost/stores/database";

const log = constants.loggers.feedback;

function idByName<T extends { id: bigint; name?: string }>(entities: T[], name: string): string {
	const entity = entities.find((entity) => entity.name?.includes(name));
	if (entity === undefined) {
		log.error(`Could not find entity with the name '${name}' in the test environment.`);
		log.error("If you haven't messed around with the guild yourself, report this error.");

		process.exit(1);
	}

	return entity.id.toString();
}

async function generateNewInviteCode({ channels }: { channels: Discord.Channel[] }): Promise<string> {
	return bot.helpers
		.createInvite(idByName(channels, "general"), { maxUses: 0, maxAge: 0 })
		.then((invite) => invite.code);
}

async function getInviteCode({ guildId }: { guildId: bigint }): Promise<string | undefined> {
	return bot.helpers
		.getInvites(guildId)
		.then((invites) => invites.find((invite) => invite.inviter?.id === bot.id))
		.then((invite) => invite?.code);
}

const environment = loadEnvironment({ log: constants.loggers.silent });
const connection = new DiscordConnection({
	environment,
	intents: Discord.Intents.Guilds | Discord.Intents.GuildMembers,
});
const bot = connection.bot;

await connection.open();

const database = DatabaseStore.create({
	log: constants.loggers.silent,
	environment,
	cache: new CacheStore({ log: constants.loggers.silent }),
});
await database.setup({ prefetchDocuments: false });

const availableMigrations = await getAvailableMigrations();
const metadata = await DatabaseMetadata.getOrCreate(database, { migrations: Object.keys(availableMigrations) });

await migrate({ log: constants.loggers.silent, database, metadata, availableMigrations });

const metadataDocument = await DatabaseMetadata.get(database);
if (metadataDocument === undefined) {
	log.error("Could not find database metadata.");
	log.error("Do not run this script manually: It depends on the migration script.");

	process.exit(1);
}

// If there is already a test environment set up.
if (metadataDocument.testGuildId !== undefined) {
	const guild = await bot.helpers.getGuild(metadataDocument.testGuildId).catch((_) => undefined);
	if (guild !== undefined) {
		const existingInviteCode =
			(await getInviteCode({ guildId: guild.id })) ??
			(await generateNewInviteCode({ channels: await bot.helpers.getChannels(guild.id) }));

		log.info(`You can find the test environment at: https://discord.gg/${existingInviteCode}`);

		process.exit();
	}

	// The bot no longer has access to the test environment, let's clear it.
	await metadataDocument.update(database, () => {
		metadataDocument.testGuildId = undefined;
	});
}

// First, we create a guild from the template.
const guild = await bot.helpers.createGuildFromTemplate(constants.TEST_GUILD_TEMPLATE_CODE, {
	name: constants.TEST_GUILD_NAME,
	icon: constants.TEST_GUILD_ICON_URL,
});

const channels = await bot.helpers.getChannels(guild.id);
const inviteCode = await generateNewInviteCode({ channels });
const roles = await bot.helpers.getRoles(guild.id);

// We give the bot a role with administrator permissions before we transfer the guild over to ourselves.
await bot.rest.addRole(guild.id, bot.id, idByName(roles, "Server Bot"));

const promise = Promise.withResolvers<Discord.Member>();
bot.events.guildMemberAdd = (member) => promise.resolve(member);

log.info(`Join the test environment at: https://discord.gg/${inviteCode}`);
log.info("Waiting for you to join...");

const member = await promise.promise;

// We transfer the guild over to ourselves.
await bot.rest.editGuild(guild.id, { ownerId: member.id });

const shutdown = bot.shutdown();

const document = new Guild(database, { guildId: guild.id.toString() });
await document.update(database, () => {
	document.enabledFeatures = {
		journalling: true,
		notices: true,
		informationNotices: true,
		resourceNotices: true,
		roleNotices: true,
		welcomeNotices: true,
		resources: true,
		targetOnly: true,
		alerts: true,
		policy: true,
		rules: true,
		purging: true,
		slowmode: true,
		timeouts: true,
		warns: true,
		reports: true,
		antiFlood: true,
		verification: true,
		dynamicVoiceChannels: true,
		entry: true,
		roleIndicators: true,
		suggestions: true,
		resourceSubmissions: true,
		tickets: true,
		music: true,
		praises: true,
		profile: true,
	};
	document.journalling = {
		purging: true,
		slowmode: true,
		timeouts: true,
		warns: true,
		reports: true,
		antiFlood: true,
		verification: true,
		suggestions: true,
		resourceSubmissions: true,
		tickets: true,
		praises: true,
	};
	document.rateLimits = {};
	document.management = {
		verification: {
			roles: [idByName(roles, "Head Guide"), idByName(roles, "Guide")],
		},
		reports: {
			roles: [idByName(roles, "Head Guide"), idByName(roles, "Guide")],
		},
		suggestions: {
			roles: [idByName(roles, "Head Guide"), idByName(roles, "Guide")],
		},
		resourceSubmissions: {
			roles: [idByName(roles, "Head Guide"), idByName(roles, "Guide"), idByName(roles, "Trainee Guide")],
		},
		tickets: {
			roles: [idByName(roles, "Head Guide"), idByName(roles, "Guide")],
		},
	};
	document.features = {
		journalling: {
			channelId: idByName(channels, "journal"),
		},
		informationNotices: {
			channelId: idByName(channels, "welcome"),
			inviteLink: `https://discord.gg/${inviteCode}`,
		},
		resourceNotices: {
			channelId: idByName(channels, "resources"),
		},
		roleNotices: {
			channelId: idByName(channels, "roles"),
		},
		welcomeNotices: {
			channelId: idByName(channels, "verify・here"),
			ruleChannelId: idByName(channels, "rule"),
		},
		resources: {
			url: "https://learnromanian.co.uk",
		},
		targetOnly: {
			channelIds: [idByName(channels, "target・language")],
		},
		alerts: {
			channelId: idByName(channels, "alerts"),
		},
		warns: {
			expiration: [2, "month"],
			limit: 3,
			autoTimeout: {
				duration: [1, "day"],
			},
		},
		reports: {
			channelId: idByName(channels, "reports"),
		},
		antiFlood: {
			interval: [5, "second"],
			messageCount: 3,
			timeoutDuration: [1, "day"],
		},
		verification: {
			channelId: idByName(channels, "verifications"),
			voting: {
				roles: [idByName(roles, "Head Guide"), idByName(roles, "Guide"), idByName(roles, "Trainee Guide")],
				verdict: {
					acceptance: {
						type: "fraction",
						value: 0.33,
					},
					rejection: {
						type: "fraction",
						value: 0.5,
					},
				},
			},
			activation: [
				{
					type: "account-age",
					value: [6, "month"],
				},
			],
		},
		dynamicVoiceChannels: {
			channels: [
				{
					id: idByName(channels, "Voice Chat"),
					maximum: 3,
				},
			],
		},
		roleIndicators: {
			limit: 1,
			roles: [],
		},
		suggestions: {
			channelId: idByName(channels, "suggestions"),
		},
		resourceSubmissions: {
			channelId: idByName(channels, "materials"),
		},
		tickets: {
			categoryId: idByName(channels, "Tickets"),
			channelId: idByName(channels, "tickets"),
		},
		music: {
			implicitVolume: 100,
		},
	};
});

await metadataDocument.update(database, () => {
	metadataDocument.testGuildId = guild.id.toString();
});

log.info("The test environment is ready.");

await shutdown;

process.exit();
