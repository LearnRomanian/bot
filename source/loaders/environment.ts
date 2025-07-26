import type pino from "pino";

interface Environment {
	readonly isDebug?: boolean;
	readonly discordSecret: string;
	readonly deeplSecret?: string;
	readonly rapidApiSecret?: string;
	readonly wordnikSecret?: string;
	readonly databaseSolution?: string;
	readonly mongodbUsername?: string;
	readonly mongodbPassword?: string;
	readonly mongodbHost?: string;
	readonly mongodbPort?: string;
	readonly mongodbDatabase?: string;
	readonly ravendbHost?: string;
	readonly ravendbPort?: string;
	readonly ravendbDatabase?: string;
	readonly ravendbSecure?: boolean;
	readonly couchdbUsername?: string;
	readonly couchdbPassword?: string;
	readonly couchdbProtocol?: string;
	readonly couchdbHost?: string;
	readonly couchdbPort?: string;
	readonly couchdbDatabase?: string;
	readonly rethinkdbUsername?: string;
	readonly rethinkdbPassword?: string;
	readonly rethinkdbHost?: string;
	readonly rethinkdbPort?: string;
	readonly rethinkdbDatabase?: string;
	readonly redisHost?: string;
	readonly redisPort?: string;
	readonly redisPassword?: string;
	readonly lavalinkHost?: string;
	readonly lavalinkPort?: string;
	readonly lavalinkPassword?: string;
}

function loadEnvironment({ log }: { log: pino.Logger }): Environment {
	log = log.child({ name: "Environment" });

	log.info("Loading environment...");

	if (process.env.SECRET_DISCORD === undefined) {
		log.error(
			"Rost cannot start without a Discord token. Make sure you've included one in the environment variables with the key `SECRET_DISCORD`.",
		);
		process.exit(1);
	}

	const environment: Environment = {
		isDebug: process.env.IS_DEBUG === "true",
		discordSecret: process.env.SECRET_DISCORD,
		deeplSecret: process.env.SECRET_DEEPL,
		rapidApiSecret: process.env.SECRET_RAPID_API,
		wordnikSecret: process.env.SECRET_WORDNIK,
		databaseSolution: process.env.DATABASE_SOLUTION,
		mongodbUsername: process.env.MONGODB_USERNAME || undefined,
		mongodbPassword: process.env.MONGODB_PASSWORD || undefined,
		mongodbHost: process.env.MONGODB_HOST,
		mongodbPort: process.env.MONGODB_PORT,
		mongodbDatabase: process.env.MONGODB_DATABASE,
		ravendbHost: process.env.RAVENDB_HOST,
		ravendbPort: process.env.RAVENDB_PORT,
		ravendbDatabase: process.env.RAVENDB_DATABASE,
		ravendbSecure: process.env.RAVENDB_SECURE === "true",
		couchdbUsername: process.env.COUCHDB_USERNAME,
		couchdbPassword: process.env.COUCHDB_PASSWORD,
		couchdbProtocol: process.env.COUCHDB_PROTOCOL,
		couchdbHost: process.env.COUCHDB_HOST,
		couchdbPort: process.env.COUCHDB_PORT,
		couchdbDatabase: process.env.COUCHDB_DATABASE,
		rethinkdbUsername: process.env.RETHINKDB_USERNAME || undefined,
		rethinkdbPassword: process.env.RETHINKDB_PASSWORD || undefined,
		rethinkdbHost: process.env.RETHINKDB_HOST,
		rethinkdbPort: process.env.RETHINKDB_PORT,
		rethinkdbDatabase: process.env.RETHINKDB_DATABASE,
		redisHost: process.env.REDIS_HOST,
		redisPort: process.env.REDIS_PORT,
		redisPassword: process.env.REDIS_PASSWORD,
		lavalinkHost: process.env.LAVALINK_HOST,
		lavalinkPort: process.env.LAVALINK_PORT,
		lavalinkPassword: process.env.LAVALINK_PASSWORD,
	};

	log.info("Environment loaded.");

	return environment;
}

export { loadEnvironment };
export type { Environment };
