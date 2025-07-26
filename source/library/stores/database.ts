import type { Collection } from "rost:constants/database";
import type { Environment } from "rost:core/loaders/environment";
import type { PromiseOr } from "rost:core/utilities";
import type pino from "pino";
import type { DatabaseAdapter, DocumentSession } from "rost/adapters/databases/adapter";
import { CouchDBAdapter } from "rost/adapters/databases/couchdb/database";
import { InMemoryAdapter } from "rost/adapters/databases/in-memory/database";
import { MongoDBAdapter } from "rost/adapters/databases/mongodb/database";
import { RavenDBAdapter } from "rost/adapters/databases/ravendb/database";
import { RethinkDBAdapter } from "rost/adapters/databases/rethinkdb/database";
import { DatabaseMetadata } from "rost/models/database-metadata";
import { EntryRequest } from "rost/models/entry-request";
import { Guild } from "rost/models/guild";
import type { Model, ModelConstructor } from "rost/models/model";
import { Praise } from "rost/models/praise";
import { Report } from "rost/models/report";
import { Resource } from "rost/models/resource";
import { Suggestion } from "rost/models/suggestion";
import { Ticket } from "rost/models/ticket";
import { User } from "rost/models/user";
import { Warning } from "rost/models/warning";
import type { CacheStore } from "rost/stores/cache";

class DatabaseStore {
	static readonly #classes: Record<Collection, ModelConstructor> = Object.freeze({
		DatabaseMetadata: DatabaseMetadata,
		EntryRequests: EntryRequest,
		Guilds: Guild,
		Praises: Praise,
		Reports: Report,
		Resources: Resource,
		Suggestions: Suggestion,
		Tickets: Ticket,
		Users: User,
		Warnings: Warning,
	} as const);

	readonly log: pino.Logger;
	readonly cache: CacheStore;

	readonly #adapter: DatabaseAdapter;

	get conventionsFor(): DatabaseAdapter["conventionsFor"] {
		return this.#adapter.conventionsFor.bind(this.#adapter);
	}

	get withSession(): <T>(callback: (session: DocumentSession) => PromiseOr<T>) => Promise<T> {
		return (callback) => this.#adapter.withSession(callback, { database: this });
	}

	constructor({ log, adapter, cache }: { log: pino.Logger; adapter: DatabaseAdapter; cache: CacheStore }) {
		this.log = log;
		this.cache = cache;

		this.#adapter = adapter;
	}

	static create({
		log,
		environment,
		cache,
	}: { log: pino.Logger; environment: Environment; cache: CacheStore }): DatabaseStore {
		log = log.child({ name: "DatabaseStore" });

		let adapter: DatabaseAdapter | undefined;
		switch (environment.databaseSolution) {
			case "mongodb": {
				adapter = MongoDBAdapter.tryCreate({ log, environment });
				break;
			}
			case "ravendb": {
				adapter = RavenDBAdapter.tryCreate({ log, environment });
				break;
			}
			case "couchdb": {
				adapter = CouchDBAdapter.tryCreate({ log, environment });
				break;
			}
			case "rethinkdb": {
				adapter = RethinkDBAdapter.tryCreate({ log, environment });
				break;
			}
		}

		if (adapter === undefined) {
			if (environment.databaseSolution === undefined) {
				log.error(
					"`DATABASE_SOLUTION` was not provided. If this was intentional, explicitly define `DATABASE_SOLUTION` as 'none'.",
				);
			}

			log.info("Rost is running in memory. Data will not persist in-between sessions.");

			adapter = new InMemoryAdapter({ log });
		}

		return new DatabaseStore({ log, adapter, cache });
	}

	static getModelClassByCollection({ collection }: { collection: Collection }): ModelConstructor {
		return DatabaseStore.#classes[collection];
	}

	async setup({ prefetchDocuments = false }: { prefetchDocuments?: boolean } = {}): Promise<void> {
		this.log.info("Setting up database store...");

		await this.#adapter.setup();

		if (prefetchDocuments) {
			await this.#prefetchDocuments();
		}

		this.log.info("Database store set up.");
	}

	async teardown(): Promise<void> {
		await this.#adapter.teardown();
	}

	async #prefetchDocuments(): Promise<void> {
		this.log.info("Prefetching documents...");

		const collections = await Promise.all([
			EntryRequest.getAll(this),
			Report.getAll(this),
			Resource.getAll(this),
			Suggestion.getAll(this),
			Ticket.getAll(this),
		]);

		const totalCount = collections.map((documents) => documents.length).reduce((a, b) => a + b, 0);
		const counts = {
			entryRequests: collections[0].length,
			reports: collections[1].length,
			resources: collections[2].length,
			suggestions: collections[3].length,
			tickets: collections[4].length,
		};
		this.log.info(`${totalCount} documents prefetched:`);
		this.log.info(`- ${counts.entryRequests} entry requests.`);
		this.log.info(`- ${counts.reports} reports.`);
		this.log.info(`- ${counts.resources} resources.`);
		this.log.info(`- ${counts.suggestions} suggestions.`);
		this.log.info(`- ${counts.tickets} tickets.`);

		for (const documents of collections) {
			this.cache.cacheDocuments<Model>(documents);
		}
	}
}

export { DatabaseStore };
