import { Collection, isValidCollection } from "logos:constants/database";
import { capitalise, decapitalise } from "logos:core/formatting";
import { Client } from "logos/client";
import { RateLimit, timeStructToMilliseconds } from "logos/database/guild";
import { DatabaseStore } from "logos/stores/database";

interface DocumentMetadata {
	readonly "@id": string;
	readonly "@collection": Collection;
	"@is-deleted"?: boolean;
}

interface RawDocument {
	[key: string]: unknown;
	"@metadata": Omit<DocumentMetadata, "@collection"> & { "@collection": string };
}

type IdentifierParts<M extends Model> = M["idParts"];
type IdentifierData<M extends Model> = { [K in IdentifierParts<M>[number]]: string };
type IdentifierDataWithDummies<M extends Model> = { [K in IdentifierParts<M>[number]]: string | undefined };
type MetadataOrIdentifierData<M extends Model> = { "@metadata": DocumentMetadata } | IdentifierData<M>;

type ClientOrDatabase = Client | DatabaseStore;

abstract class Model<Generic extends { idParts: readonly string[] } = any> {
	declare readonly id: string;

	readonly "@metadata": DocumentMetadata;

	readonly #_idParts: Generic["idParts"];

	abstract get createdAt(): number;

	get idParts(): Generic["idParts"] {
		return this.#_idParts;
	}

	get partialId(): string {
		return this.#_idParts.join(constants.special.database.separator);
	}

	constructor({ "@metadata": metadata }: { "@metadata": DocumentMetadata }) {
		const [_, idParts] = Model.getDataFromId(metadata["@id"]);

		this["@metadata"] = metadata;

		this.#_idParts = idParts;
	}

	static #hasMetadata<M extends Model>(data: MetadataOrIdentifierData<M>): data is { "@metadata": DocumentMetadata } {
		return "@metadata" in data;
	}

	static buildMetadata<M extends Model>(
		data: MetadataOrIdentifierData<M>,
		{ collection }: { collection: Collection },
	): DocumentMetadata {
		return Model.#hasMetadata(data)
			? data["@metadata"]
			: { "@collection": collection, "@id": Model.buildId<M>(data, { collection }) };
	}

	static buildPartialId<M extends Model>(data: IdentifierData<M>): string {
		const parts: string[] = [];
		for (const part of constants.database.identifierParts) {
			if (!(part in data)) {
				continue;
			}

			parts.push(data[part as keyof typeof data]);
		}

		return parts.join(constants.special.database.separator);
	}

	static buildId<M extends Model>(data: IdentifierData<M>, { collection }: { collection: Collection }): string {
		const collectionCamelcase = decapitalise(collection);
		const partialId = Model.buildPartialId(data);

		return `${collectionCamelcase}${constants.special.database.separator}${partialId}`;
	}

	static getDataFromId<M extends Model>(id: string): [collection: Collection, data: IdentifierParts<M>] {
		const [collectionCamelcase, ...data] = id.split(constants.special.database.separator) as [string, string[]];
		const collection = capitalise(collectionCamelcase);
		if (!isValidCollection(collection)) {
			throw `Collection "${collectionCamelcase}" encoded in ID "${id}" is unknown.`;
		}

		return [collection as Collection, data as IdentifierParts<M>];
	}

	static #withDummiesReplaced<M extends Model>(
		data: IdentifierDataWithDummies<M>,
		{ value }: { value: string },
	): IdentifierData<M> {
		return Object.fromEntries(Object.entries(data).map(([key, value_]) => [key, value_ ?? value])) as IdentifierData<M>;
	}

	static async all<M extends Model>(
		clientOrDatabase: ClientOrDatabase,
		{ collection, where }: { collection: Collection; where?: IdentifierDataWithDummies<M> },
	): Promise<M[]> {
		const { promise, resolve } = Promise.withResolvers<M[]>();

		await getDatabase(clientOrDatabase).withSession(async (session) => {
			let query = session.query<M>({ collection });

			if (where !== undefined) {
				const clause = Model.#withDummiesReplaced(where, { value: "\\d+" });
				query = query.whereRegex("id", Model.buildId(clause, { collection }));
			}

			const result = await query.all();

			resolve(result);
		});

		return promise;
	}

	static crossesRateLimit<M extends Model>(documents: M[], rateLimit: RateLimit): boolean {
		const timestamps = documents.map((document) => document.createdAt);

		const actionTimestamps = timestamps.sort((a, b) => b - a); // From most recent to least recent.
		const relevantTimestamps = actionTimestamps.slice(0, rateLimit.uses);

		// Has not reached the limit, regardless of the limiting time period.
		if (relevantTimestamps.length < rateLimit.uses) {
			return false;
		}

		const now = Date.now();
		const interval = timeStructToMilliseconds(rateLimit.within);

		return relevantTimestamps.some((timestamp) => now - timestamp < interval);
	}

	async create(clientOrDatabase: ClientOrDatabase): Promise<void> {
		await getDatabase(clientOrDatabase).withSession(async (session) => {
			await session.set(this);
		});
	}

	async update(clientOrDatabase: ClientOrDatabase, callback: () => void): Promise<void> {
		await getDatabase(clientOrDatabase).withSession(async (session) => {
			callback();
			await session.set(this);
		});
	}

	async delete(clientOrDatabase: ClientOrDatabase): Promise<void> {
		await this.update(clientOrDatabase, () => {
			this["@metadata"]["@is-deleted"] = true;
		});

		await getDatabase(clientOrDatabase).withSession(async (session) => {
			await session.remove(this);
		});
	}
}

function getDatabase(clientOrDatabase: ClientOrDatabase): DatabaseStore {
	if (clientOrDatabase instanceof Client) {
		return clientOrDatabase.database;
	}

	return clientOrDatabase;
}

export { Model };
export type {
	RawDocument,
	DocumentMetadata,
	IdentifierParts,
	IdentifierData,
	MetadataOrIdentifierData,
	ClientOrDatabase,
};
