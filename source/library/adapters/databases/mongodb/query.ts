import type { Collection } from "rost:constants/database";
import type mongodb from "mongodb";
import { DocumentQuery } from "rost/adapters/databases/adapter";
import { MongoDBDocumentConventions } from "rost/adapters/databases/mongodb/conventions";
import type { MongoDBDocument } from "rost/adapters/databases/mongodb/document";
import type { MongoDBDocumentSession } from "rost/adapters/databases/mongodb/session";
import type { Model } from "rost/models/model";

class MongoDBDocumentQuery<M extends Model> extends DocumentQuery<M> {
	readonly #mongoDatabase: mongodb.Db;
	readonly #session: MongoDBDocumentSession;
	readonly #collection: Collection;
	readonly #filter: mongodb.Filter<MongoDBDocument>;

	constructor({
		mongoDatabase,
		session,
		collection,
	}: {
		mongoDatabase: mongodb.Db;
		session: MongoDBDocumentSession;
		collection: Collection;
	}) {
		super();

		this.#mongoDatabase = mongoDatabase;
		this.#session = session;
		this.#collection = collection;
		this.#filter = {};
	}

	whereRegex(property: string, pattern: RegExp): this {
		Object.assign(this.#filter, { [property === "id" ? "_id" : property]: { $regex: pattern } });
		return this;
	}

	whereEquals(property: string, value: unknown): this {
		Object.assign(this.#filter, { [property === "id" ? "_id" : property]: { $eq: value } });
		return this;
	}

	async execute(): Promise<M[]> {
		const rawDocuments = await this.#mongoDatabase
			.collection<MongoDBDocument>(this.#collection)
			.find(this.#filter)
			.toArray();
		return rawDocuments.map((rawDocument) =>
			MongoDBDocumentConventions.instantiateModel(this.#session.database, rawDocument),
		);
	}
}

export { MongoDBDocumentQuery };
