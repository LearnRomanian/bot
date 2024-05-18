import type { Collection } from "logos:constants/database";
import type { Environment } from "logos:core/loaders/environment";
import { DatabaseAdapter, type DocumentConventions } from "logos/adapters/databases/adapter";
import { RethinkDBDocumentConventions } from "logos/adapters/databases/rethinkdb/conventions";
import type { RethinkDBDocumentMetadata } from "logos/adapters/databases/rethinkdb/document";
import { RethinkDBDocumentSession } from "logos/adapters/databases/rethinkdb/session";
import type { Logger } from "logos/logger";
import type { IdentifierDataOrMetadata, Model } from "logos/models/model";
import type { DatabaseStore } from "logos/stores/database";
import rethinkdb from "rethinkdb-ts";

class RethinkDBAdapter extends DatabaseAdapter {
	readonly #connectionOptions: rethinkdb.RConnectionOptions;
	#connection!: rethinkdb.Connection;

	constructor({
		environment,
		username,
		password,
		host,
		port,
		database,
	}: {
		environment: Environment;
		username?: string;
		password?: string;
		host: string;
		port: string;
		database: string;
	}) {
		super({ environment, identifier: "RethinkDB" });

		this.#connectionOptions = { host, port: Number(port), db: database, user: username, password };
	}

	static tryCreate({ environment, log }: { environment: Environment; log: Logger }): RethinkDBAdapter | undefined {
		if (
			environment.rethinkdbHost === undefined ||
			environment.rethinkdbPort === undefined ||
			environment.rethinkdbDatabase === undefined
		) {
			log.error(
				"One or more of `RETHINKDB_HOST`, `RETHINKDB_PORT` or `RETHINKDB_DATABASE` have not been provided.",
			);
			return undefined;
		}

		return new RethinkDBAdapter({
			environment,
			username: environment.rethinkdbUsername,
			password: environment.rethinkdbPassword,
			host: environment.rethinkdbHost,
			port: environment.rethinkdbPort,
			database: environment.rethinkdbDatabase,
		});
	}

	async setup(): Promise<void> {
		this.#connection = await rethinkdb.r.connect(this.#connectionOptions);
		await this.#createMissingTables();
	}

	async teardown(): Promise<void> {
		await this.#connection.close();
	}

	conventionsFor({
		document,
		data,
		collection,
	}: {
		document: Model;
		data: IdentifierDataOrMetadata<Model, RethinkDBDocumentMetadata>;
		collection: Collection;
	}): DocumentConventions {
		return new RethinkDBDocumentConventions({ document, data, collection });
	}

	openSession({
		environment,
		database,
	}: { environment: Environment; database: DatabaseStore }): RethinkDBDocumentSession {
		return new RethinkDBDocumentSession({ environment, database, connection: this.#connection });
	}

	async #createMissingTables(): Promise<void> {
		const tableList = await rethinkdb.r.tableList().run(this.#connection);

		const queries: rethinkdb.RDatum<rethinkdb.TableChangeResult>[] = [];
		for (const collection of constants.database.collections) {
			if (tableList.includes(collection)) {
				continue;
			}

			queries.push(rethinkdb.r.tableCreate(collection));
		}

		if (queries.length === 0) {
			return;
		}

		this.log.info(`Creating missing tables (${queries.length} to create). This may take a moment...`);

		await rethinkdb.r.expr(queries).run(this.#connection);
	}
}

export { RethinkDBAdapter };
