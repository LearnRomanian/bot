import type { Collection } from "rost:constants/database";
import type * as ravendb from "ravendb";
import { DocumentQuery } from "rost/adapters/databases/adapter";
import { RavenDBDocumentConventions } from "rost/adapters/databases/ravendb/conventions";
import type { RavenDBDocument } from "rost/adapters/databases/ravendb/document";
import type { Model } from "rost/models/model";
import type { DatabaseStore } from "rost/stores/database";

class RavenDBDocumentQuery<M extends Model> extends DocumentQuery<M> {
	readonly #database: DatabaseStore;
	readonly #session: ravendb.IDocumentSession;
	#query: ravendb.IDocumentQuery<RavenDBDocument>;

	constructor({
		database,
		session,
		collection,
	}: { database: DatabaseStore; session: ravendb.IDocumentSession; collection: Collection }) {
		super();

		this.#database = database;
		this.#session = session;
		this.#query = this.#session.query({ collection });
	}

	whereRegex(property: string, pattern: RegExp): this {
		this.#query = this.#query.whereRegex(property === "id" ? "id()" : property, pattern.source);
		return this;
	}

	whereEquals(property: string, value: unknown): this {
		this.#query = this.#query.whereEquals(property === "id" ? "id()" : property, value);
		return this;
	}

	async execute(): Promise<M[]> {
		const rawDocuments = await this.#query.all();
		return rawDocuments.map((document) => RavenDBDocumentConventions.instantiateModel(this.#database, document));
	}
}

export { RavenDBDocumentQuery };
