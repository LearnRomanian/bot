import type { Collection } from "rost:constants/database";
import type nano from "nano";
import { DocumentQuery } from "rost/adapters/databases/adapter";
import type { CouchDBDocumentSession } from "rost/adapters/databases/couchdb/session";
import { Model } from "rost/models/model";

class CouchDBDocumentQuery<M extends Model> extends DocumentQuery<M> {
	readonly #documents: nano.DocumentScope<unknown>;
	readonly #session: CouchDBDocumentSession;
	readonly #query: nano.MangoQuery;

	constructor({
		documents,
		session,
		collection,
	}: { documents: nano.DocumentScope<unknown>; session: CouchDBDocumentSession; collection: Collection }) {
		super();

		this.#documents = documents;
		this.#session = session;
		this.#query = { selector: { _id: { $regex: Model.composeId(".+", { collection }) } } };
	}

	whereRegex(property: string, pattern: RegExp): this {
		this.#mergeSelectors(property === "id" ? "_id" : property, { $regex: pattern.source });

		return this;
	}

	whereEquals(property: string, value: unknown): this {
		this.#mergeSelectors(property === "id" ? "_id" : property, { $eq: value as nano.MangoValue });

		return this;
	}

	#mergeSelectors(property: string, selector: nano.MangoSelector): void {
		Object.assign(this.#query.selector, {
			[property]: Object.assign(this.#query.selector[property] ?? {}, selector),
		});
	}

	async execute(): Promise<M[]> {
		const result = await this.#documents.find(this.#query);
		const ids = result.docs.map((document) => document._id);
		return (await this.#session.loadMany(ids)) as M[];
	}
}

export { CouchDBDocumentQuery };
