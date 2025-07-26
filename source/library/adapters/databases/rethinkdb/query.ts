import type { Collection } from "rost:constants/database";
import rethinkdb from "rethinkdb-ts";
import { DocumentQuery } from "rost/adapters/databases/adapter";
import { RethinkDBDocumentConventions } from "rost/adapters/databases/rethinkdb/conventions";
import type { RethinkDBDocument } from "rost/adapters/databases/rethinkdb/document";
import type { Model } from "rost/models/model";
import type { DatabaseStore } from "rost/stores/database";

class RethinkDBDocumentQuery<M extends Model> extends DocumentQuery<M> {
	readonly #collection: Collection;
	readonly #database: DatabaseStore;
	readonly #connection: rethinkdb.Connection;
	#query: rethinkdb.RTable<RethinkDBDocument>;

	constructor({
		database,
		connection,
		collection,
	}: { database: DatabaseStore; connection: rethinkdb.Connection; collection: Collection }) {
		super();

		this.#collection = collection;
		this.#database = database;
		this.#connection = connection;
		this.#query = rethinkdb.r.table(this.#collection);
	}

	whereRegex(property: string, pattern: RegExp): this {
		this.#query = this.#query.filter((document) => document(property).match(pattern.source));
		return this;
	}

	whereEquals(property: string, value: unknown): this {
		this.#query = this.#query.filter({ [property]: value });
		return this;
	}

	async execute(): Promise<M[]> {
		const rawDocuments = await this.#query.run(this.#connection);
		return rawDocuments.map((rawDocument) =>
			RethinkDBDocumentConventions.instantiateModel<M>(this.#database, rawDocument),
		);
	}
}

export { RethinkDBDocumentQuery };
