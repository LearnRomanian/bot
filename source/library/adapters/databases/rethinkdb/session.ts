import type { Collection } from "rost:constants/database";
import rethinkdb from "rethinkdb-ts";
import { DocumentSession } from "rost/adapters/databases/adapter";
import { RethinkDBDocumentConventions } from "rost/adapters/databases/rethinkdb/conventions";
import type { RethinkDBDocument } from "rost/adapters/databases/rethinkdb/document";
import { RethinkDBDocumentQuery } from "rost/adapters/databases/rethinkdb/query";
import { Model } from "rost/models/model";
import type { DatabaseStore } from "rost/stores/database";

class RethinkDBDocumentSession extends DocumentSession {
	readonly #connection: rethinkdb.Connection;

	constructor({ database, connection }: { database: DatabaseStore; connection: rethinkdb.Connection }) {
		super({ identifier: "RethinkDB", database });

		this.#connection = connection;
	}

	async load<M extends Model>(id: string): Promise<M | undefined> {
		const [collection, _] = Model.decomposeId(id);
		const rawDocument = await rethinkdb.r
			.get<RethinkDBDocument | null>(rethinkdb.r.table(collection), id)
			.run(this.#connection);
		if (rawDocument === null) {
			return undefined;
		}

		return RethinkDBDocumentConventions.instantiateModel<M>(this.database, rawDocument);
	}

	async loadMany<M extends Model>(ids: string[]): Promise<(M | undefined)[]> {
		return this.loadManyTabulated(ids, {
			loadMany: (ids, { collection }) =>
				rethinkdb.r
					// @ts-expect-error: The type signature of `getAll()` is invalid; The underlying JS code supports an
					// indefinite number of IDs, so this call is completely fine.
					//
					// https://github.com/rethinkdb/rethinkdb-ts/issues/126
					.getAll<RethinkDBDocument>(rethinkdb.r.table(collection), ...ids)
					.run(this.#connection),
			instantiateModel: (database, rawDocument) =>
				RethinkDBDocumentConventions.instantiateModel<M>(database, rawDocument),
		});
	}

	async #alreadyExists(id: string, { collection }: { collection: Collection }): Promise<boolean> {
		return rethinkdb.r.table(collection).getAll(id).count().eq(1).run(this.#connection);
	}

	async store<M extends Model>(document: M): Promise<void> {
		const alreadyExists = await this.#alreadyExists(document.id, { collection: document.collection });

		let query: rethinkdb.RDatum;
		if (alreadyExists) {
			query = rethinkdb.r.replace(rethinkdb.r.table(document.collection), document);
		} else {
			query = rethinkdb.r.insert(rethinkdb.r.table(document.collection), document);
		}

		await query.run(this.#connection);
	}

	query<M extends Model>({ collection }: { collection: Collection }): RethinkDBDocumentQuery<M> {
		return new RethinkDBDocumentQuery<M>({ database: this.database, connection: this.#connection, collection });
	}
}

export { RethinkDBDocumentSession };
