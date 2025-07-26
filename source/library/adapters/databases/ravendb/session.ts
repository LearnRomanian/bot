import type { Collection } from "rost:constants/database";
import type * as ravendb from "ravendb";
import { DocumentSession } from "rost/adapters/databases/adapter";
import { RavenDBDocumentConventions } from "rost/adapters/databases/ravendb/conventions";
import type { RavenDBDocument } from "rost/adapters/databases/ravendb/document";
import { RavenDBDocumentQuery } from "rost/adapters/databases/ravendb/query";
import type { Model } from "rost/models/model";
import type { DatabaseStore } from "rost/stores/database";

class RavenDBDocumentSession extends DocumentSession {
	readonly #session: ravendb.IDocumentSession;

	constructor({ database, session }: { database: DatabaseStore; session: ravendb.IDocumentSession }) {
		super({ identifier: "RavenDB", database });

		this.#session = session;

		// The following line is vital to the valid functioning of the RavenDB session: it prevents the RavenDB client
		// from trying to convert raw documents into an entity (i.e. a class) by itself.
		this.#session.advanced.entityToJson.convertToEntity = (_, __, document, ___) => document;
	}

	async load<M extends Model>(id: string): Promise<M | undefined> {
		const rawDocument = await this.#session.load(id);
		if (rawDocument === null) {
			return undefined;
		}

		return RavenDBDocumentConventions.instantiateModel<M>(this.database, rawDocument as RavenDBDocument);
	}

	async loadMany<M extends Model>(ids: string[]): Promise<(M | undefined)[]> {
		const documents: (M | undefined)[] = [];
		const rawDocuments = await this.#session.load(ids);
		for (const rawDocument of Object.values(rawDocuments)) {
			if (rawDocument === null) {
				documents.push(undefined);
				continue;
			}

			documents.push(
				RavenDBDocumentConventions.instantiateModel<M>(this.database, rawDocument as RavenDBDocument),
			);
		}

		return documents;
	}

	async store<M extends Model>(document: M): Promise<void> {
		await this.#session.store(document, document.id);
		await this.#session.saveChanges();
	}

	query<M extends Model>({ collection }: { collection: Collection }): RavenDBDocumentQuery<M> {
		return new RavenDBDocumentQuery<M>({ database: this.database, session: this.#session, collection });
	}

	async dispose(): Promise<void> {
		this.#session.dispose();
	}
}

export { RavenDBDocumentSession };
