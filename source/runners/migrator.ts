import constants from "rost:constants/constants";
import type pino from "pino";
import type { DatabaseMetadata } from "rost/models/database-metadata";
import type { DatabaseStore } from "rost/stores/database";

async function migrate({
	log,
	database,
	metadata,
	availableMigrations,
}: {
	log: pino.Logger;
	database: DatabaseStore;
	metadata: DatabaseMetadata;
	availableMigrations: AvailableMigrations;
}): Promise<void> {
	const completeMigrations = new Set(metadata.migrations);
	const migrationsToExecute = Object.entries(availableMigrations).filter(
		(migration) => !completeMigrations.has(migration[0]),
	);
	if (migrationsToExecute.length === 0) {
		log.info("Migrations up to date!");
		return;
	}

	log.info(`Found ${migrationsToExecute.length} migration(s) to execute.`);

	for (const [migration, filename] of migrationsToExecute) {
		const module: { up(database: DatabaseStore): Promise<void> } = await import(
			`../../${constants.directories.migrations}/${filename}`
		);

		log.info(`Executing ${filename}...`);

		try {
			await module.up(database);
		} catch (error) {
			log.error(error, `Failed to run migration '${filename}'.`);

			process.exit(1);
		}

		await metadata.update(database, () => {
			metadata.migrations.push(migration);
		});
	}

	log.info("Migrated!");
}

type Migration = [migration: string, filename: string];
async function rollback({
	log,
	database,
	metadata,
	availableMigrations,
	step,
}: {
	log: pino.Logger;
	database: DatabaseStore;
	metadata: DatabaseMetadata;
	availableMigrations: AvailableMigrations;
	step: number;
}): Promise<void> {
	const migrationsToRollback = metadata.migrations;
	if (migrationsToRollback.length === 0) {
		log.info("There are no migrations to roll back.");
		return;
	}

	log.info(`Rolling back ${step} migration(s)...`);

	const migrations = migrationsToRollback
		.map<Migration>((migration) => {
			const filename = availableMigrations[migration];
			if (filename === undefined) {
				log.error(`Could not find file for migration '${migration}'. Does it exist?`);

				process.exit(1);
			}

			return [migration, filename];
		})
		.toReversed()
		.slice(0, step);

	for (const [_, filename] of migrations) {
		const module: { down(database: DatabaseStore): Promise<void> } = await import(
			`../../${constants.directories.migrations}/${filename}`
		);

		log.info(`Rolling back ${filename}...`);

		try {
			await module.down(database);
		} catch (error) {
			log.error(error, `Failed to roll back ${filename}.`);

			process.exit(1);
		}

		await metadata.update(database, () => {
			metadata.migrations.pop();
		});
	}

	log.info("Rolled back!");
}

type AvailableMigrations = Record<string, string>;
async function getAvailableMigrations(): Promise<AvailableMigrations> {
	const migrationFilenames = await Array.fromAsync(new Bun.Glob("*.js").scan(constants.directories.migrations)).then(
		(filenames) => filenames.toSorted((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })),
	);

	return Object.fromEntries(migrationFilenames.map((filename) => [filename.split("_").at(0)!, filename]));
}

export { migrate, rollback, getAvailableMigrations };
