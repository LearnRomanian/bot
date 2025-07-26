import fs from "node:fs";
import type { Collection } from "rost:constants/database";
import type { Environment } from "rost:core/loaders/environment";
import type pino from "pino";
import * as ravendb from "ravendb";
import { DatabaseAdapter, type DocumentConventions } from "rost/adapters/databases/adapter";
import { RavenDBDocumentConventions } from "rost/adapters/databases/ravendb/conventions";
import type { RavenDBDocumentMetadataContainer } from "rost/adapters/databases/ravendb/document";
import { RavenDBDocumentSession } from "rost/adapters/databases/ravendb/session";
import type { IdentifierDataOrMetadata, Model } from "rost/models/model";
import type { DatabaseStore } from "rost/stores/database";

class RavenDBAdapter extends DatabaseAdapter {
	readonly #documents: ravendb.DocumentStore;
	readonly #databaseName: string;

	constructor({
		log,
		host,
		port,
		database,
		certificate,
	}: { log: pino.Logger; host: string; port: string; database: string; certificate?: Buffer }) {
		super({ identifier: "RavenDB", log });

		const protocol = certificate !== undefined ? "https" : "http";

		const url = `${protocol}://${host}:${port}`;
		if (certificate !== undefined) {
			this.#documents = new ravendb.DocumentStore(url, database, { certificate, type: "pfx" });
		} else {
			this.#documents = new ravendb.DocumentStore(url, database);
		}
		this.#databaseName = database;

		// @ts-expect-error: We don't want RavenDB to be setting the `id` property on documents since we handle that
		// ourselves.
		this.#documents.conventions.getIdentityProperty = () => undefined;
	}

	static tryCreate({ environment, log }: { log: pino.Logger; environment: Environment }): RavenDBAdapter | undefined {
		if (
			environment.ravendbHost === undefined ||
			environment.ravendbPort === undefined ||
			environment.ravendbDatabase === undefined
		) {
			log.error("One or more of `RAVENDB_HOST`, `RAVENDB_PORT` or `RAVENDB_DATABASE` have not been provided.");
			return undefined;
		}

		let certificate: Buffer | undefined;
		if (environment.ravendbSecure) {
			certificate = fs.readFileSync(".cert.pfx");
		}

		return new RavenDBAdapter({
			log,
			host: environment.ravendbHost,
			port: environment.ravendbPort,
			database: environment.ravendbDatabase,
			certificate,
		});
	}

	async setup(): Promise<void> {
		this.#documents.initialize();

		const databaseNames = await this.#documents.maintenance.server.send(
			new ravendb.GetDatabaseNamesOperation(0, 10),
		);
		const databaseExists = databaseNames.includes(this.#databaseName);
		if (!databaseExists) {
			this.log.info(`The database '${this.#databaseName}' does not exist. Creating...`);

			try {
				await this.#documents.maintenance.server.send(
					new ravendb.CreateDatabaseOperation({ databaseName: this.#databaseName }),
				);
			} catch (error: any) {
				this.log.error(error, `Could not create database '${this.#databaseName}'.`);
				throw error;
			}

			this.log.info(`Created database '${this.#databaseName}'.`);
		}
	}

	async teardown(): Promise<void> {
		this.#documents.dispose();
	}

	conventionsFor({
		document,
		data,
		collection,
	}: {
		document: Model;
		data: IdentifierDataOrMetadata<Model, RavenDBDocumentMetadataContainer>;
		collection: Collection;
	}): DocumentConventions {
		return new RavenDBDocumentConventions({ document, data, collection });
	}

	openSession({ database }: { database: DatabaseStore }): RavenDBDocumentSession {
		const rawSession = this.#documents.openSession();

		return new RavenDBDocumentSession({ database, session: rawSession });
	}
}

export { RavenDBAdapter };
