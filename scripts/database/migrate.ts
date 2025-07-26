import { parseArgs } from "node:util";
import { loadEnvironment } from "rost:core/loaders/environment";
import { getAvailableMigrations, migrate, rollback } from "rost:core/runners/migrator";
import bun from "bun";
import { DatabaseMetadata } from "rost/models/database-metadata";
import { CacheStore } from "rost/stores/cache";
import { DatabaseStore } from "rost/stores/database";

const log = constants.loggers.feedback;

const { values } = parseArgs({
	args: bun.argv,
	options: {
		rollback: {
			type: "boolean",
			short: "b",
		},
		step: {
			type: "string",
		},
	},
	strict: true,
	allowPositionals: true,
});

if (values.step !== undefined && !Number.isSafeInteger(Number(values.step))) {
	log.error(`'${values.step}' is not a valid integer.`);

	process.exit(1);
}

log.info("Checking for migrations...");

const environment = loadEnvironment({ log: constants.loggers.silent });
const database = DatabaseStore.create({
	log: constants.loggers.silent,
	environment,
	cache: new CacheStore({ log: constants.loggers.silent }),
});
await database.setup({ prefetchDocuments: false });

const availableMigrations = await getAvailableMigrations();
const metadata = await DatabaseMetadata.getOrCreate(database, { migrations: Object.keys(availableMigrations) });

const direction = values.rollback ? "down" : "up";
switch (direction) {
	case "up": {
		await migrate({ log, database, metadata, availableMigrations });
		break;
	}
	case "down": {
		const step = values.step !== undefined ? Number(values.step) : 1;
		await rollback({ log, database, metadata, availableMigrations, step });
		break;
	}
}

process.exit();
