import type { Collection } from "rost:constants/database";
import type { Environment } from "rost:core/loaders/environment";
import nano from "nano";
import type pino from "pino";
import { DatabaseAdapter, type DocumentConventions } from "rost/adapters/databases/adapter";
import { CouchDBDocumentConventions } from "rost/adapters/databases/couchdb/conventions";
import type { CouchDBDocumentMetadata } from "rost/adapters/databases/couchdb/document";
import { CouchDBDocumentSession } from "rost/adapters/databases/couchdb/session";
import type { IdentifierDataOrMetadata, Model } from "rost/models/model";
import type { DatabaseStore } from "rost/stores/database";

class CouchDBAdapter extends DatabaseAdapter {
	readonly #server: nano.ServerScope;
	readonly #databaseName: string;
	#documents!: nano.DocumentScope<unknown>;

	constructor({
		log,
		username,
		password,
		protocol,
		host,
		port,
		database,
	}: {
		log: pino.Logger;
		username: string;
		password: string;
		protocol?: string;
		host: string;
		port: string;
		database: string;
	}) {
		super({ identifier: "CouchDB", log });

		protocol ||= "http";

		let url: string;
		if (username !== undefined) {
			if (password !== undefined) {
				url = `${protocol}://${username}:${password}@${host}:${port}`;
			} else {
				url = `${protocol}://${username}@${host}:${port}`;
			}
		} else {
			url = `${protocol}://${host}:${port}`;
		}

		this.#server = nano({
			url,
			requestDefaults: { headers: { "User-Agent": constants.USER_AGENT } },
		});
		this.#databaseName = database;
	}

	static tryCreate({ log, environment }: { log: pino.Logger; environment: Environment }): CouchDBAdapter | undefined {
		if (
			environment.couchdbUsername === undefined ||
			environment.couchdbPassword === undefined ||
			environment.couchdbHost === undefined ||
			environment.couchdbPort === undefined ||
			environment.couchdbDatabase === undefined
		) {
			log.error(
				"One or more of `COUCHDB_USERNAME`, `COUCHDB_PASSWORD`, `COUCHDB_HOST`, `COUCHDB_PORT` or `COUCHDB_DATABASE` have not been provided.",
			);
			return undefined;
		}

		return new CouchDBAdapter({
			log,
			username: environment.couchdbUsername,
			password: environment.couchdbPassword,
			host: environment.couchdbHost,
			port: environment.couchdbPort,
			database: environment.couchdbDatabase,
		});
	}

	async setup(): Promise<void> {
		let databaseExists = true;
		try {
			await this.#server.db.get(this.#databaseName);
		} catch (error: any) {
			if (error.statusCode !== 404) {
				this.log.error(error, `Failed to get information for database '${this.#databaseName}'.`);
				throw error;
			}

			databaseExists = false;
		}

		if (!databaseExists) {
			this.log.info(`The database '${this.#databaseName}' does not exist. Creating...`);

			try {
				await this.#server.db.create(this.#databaseName);
			} catch (error: any) {
				this.log.error(error, `Could not create database '${this.#databaseName}'.`);
				throw error;
			}

			this.log.info(`Created database '${this.#databaseName}'.`);
		}

		this.#documents = this.#server.db.use(this.#databaseName);
	}

	conventionsFor({
		document,
		data,
		collection,
	}: {
		document: Model;
		data: IdentifierDataOrMetadata<Model, CouchDBDocumentMetadata>;
		collection: Collection;
	}): DocumentConventions {
		return new CouchDBDocumentConventions({ document, data, collection });
	}

	openSession({ database }: { database: DatabaseStore }): CouchDBDocumentSession {
		return new CouchDBDocumentSession({ database, documents: this.#documents });
	}
}

export { CouchDBAdapter };
