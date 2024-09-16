import fs from "node:fs/promises";
import type { Collection } from "logos:constants/database";
import type { Environment } from "logos:core/loaders/environment";
import { DatabaseAdapter, type DocumentConventions } from "logos/adapters/databases/adapter";
import { RavenDBDocumentConventions } from "logos/adapters/databases/ravendb/conventions";
import type { RavenDBDocumentMetadataContainer } from "logos/adapters/databases/ravendb/document";
import { RavenDBDocumentSession } from "logos/adapters/databases/ravendb/session";
import type { IdentifierDataOrMetadata, Model } from "logos/models/model";
import type { DatabaseStore } from "logos/stores/database";
import type pino from "pino";
import * as ravendb from "ravendb";

class RavenDBAdapter extends DatabaseAdapter {
	readonly #database: ravendb.DocumentStore;

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
			this.#database = new ravendb.DocumentStore(url, database, { certificate, type: "pfx" });
		} else {
			this.#database = new ravendb.DocumentStore(url, database);
		}

		// @ts-expect-error: We don't want RavenDB to be setting the `id` property on documents since we handle that
		// ourselves.
		this.#database.conventions.getIdentityProperty = () => undefined;
	}

	static async tryCreate({
		environment,
		log,
	}: { log: pino.Logger; environment: Environment }): Promise<RavenDBAdapter | undefined> {
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
			certificate = await fs.readFile(".cert.pfx");
		}

		return new RavenDBAdapter({
			log,
			host: environment.ravendbHost,
			port: environment.ravendbPort,
			database: environment.ravendbDatabase,
			certificate,
		});
	}

	setup(): void {
		this.#database.initialize();
	}

	teardown(): void {
		this.#database.dispose();
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
		const rawSession = this.#database.openSession();

		return new RavenDBDocumentSession({ database, session: rawSession });
	}
}

export { RavenDBAdapter };
