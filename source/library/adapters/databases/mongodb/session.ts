import type { Collection } from "rost:constants/database";
import type mongodb from "mongodb";
import { DocumentSession } from "rost/adapters/databases/adapter";
import { MongoDBDocumentConventions } from "rost/adapters/databases/mongodb/conventions";
import type { MongoDBDocument } from "rost/adapters/databases/mongodb/document";
import { MongoDBDocumentQuery } from "rost/adapters/databases/mongodb/query";
import { Model } from "rost/models/model";
import type { DatabaseStore } from "rost/stores/database";

class MongoDBDocumentSession extends DocumentSession {
	readonly #mongoDatabase: mongodb.Db;

	constructor({ database, mongoDatabase }: { database: DatabaseStore; mongoDatabase: mongodb.Db }) {
		super({ identifier: "MongoDB", database });

		this.#mongoDatabase = mongoDatabase;
	}

	async load<M extends Model>(id: string): Promise<M | undefined> {
		const [collection, _] = Model.decomposeId(id);
		const rawDocument = await this.#mongoDatabase.collection<MongoDBDocument>(collection).findOne({ _id: id });
		if (rawDocument === null) {
			return undefined;
		}

		return MongoDBDocumentConventions.instantiateModel<M>(this.database, rawDocument as MongoDBDocument);
	}

	async loadMany<M extends Model>(ids: string[]): Promise<(M | undefined)[]> {
		return this.loadManyTabulated<M, MongoDBDocument>(ids, {
			loadMany: (ids, { collection }) =>
				this.#mongoDatabase.collection<MongoDBDocument>(collection).find({ _id: ids }).toArray(),
			instantiateModel: (database, rawDocument) =>
				MongoDBDocumentConventions.instantiateModel<M>(database, rawDocument),
		});
	}

	async store<M extends Model>(document: M): Promise<void> {
		const [collection, _] = Model.decomposeId(document.id);
		await this.#mongoDatabase
			.collection<MongoDBDocument>(collection)
			.updateOne({ _id: document.id }, { $set: document as unknown as MongoDBDocument }, { upsert: true });
	}

	query<M extends Model>({ collection }: { collection: Collection }): MongoDBDocumentQuery<M> {
		return new MongoDBDocumentQuery<M>({ mongoDatabase: this.#mongoDatabase, session: this, collection });
	}
}

export { MongoDBDocumentSession };
