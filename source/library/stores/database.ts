import type { Collection } from "logos:constants/database";
import type { Environment } from "logos:core/loaders/environment";
import type { DatabaseAdapter, DocumentSession } from "logos/adapters/databases/adapter";
import { CouchDBAdapter } from "logos/adapters/databases/couchdb/database";
import { InMemoryAdapter } from "logos/adapters/databases/in-memory/database";
import { MongoDBAdapter } from "logos/adapters/databases/mongodb/database";
import { RavenDBAdapter } from "logos/adapters/databases/ravendb/database";
import { RethinkDBAdapter } from "logos/adapters/databases/rethinkdb/database";
import { Logger } from "logos/logger";
import { DatabaseMetadata } from "logos/models/database-metadata";
import { EntryRequest } from "logos/models/entry-request";
import { Guild } from "logos/models/guild";
import { GuildStatistics } from "logos/models/guild-statistics";
import type { Model, ModelConstructor } from "logos/models/model";
import { Praise } from "logos/models/praise";
import { Report } from "logos/models/report";
import { Resource } from "logos/models/resource";
import { Suggestion } from "logos/models/suggestion";
import { Ticket } from "logos/models/ticket";
import { User } from "logos/models/user";
import { Warning } from "logos/models/warning";

class DatabaseStore {
	static readonly #classes: Record<Collection, ModelConstructor> = Object.freeze({
		DatabaseMetadata: DatabaseMetadata,
		EntryRequests: EntryRequest,
		GuildStatistics: GuildStatistics,
		Guilds: Guild,
		Praises: Praise,
		Reports: Report,
		Resources: Resource,
		Suggestions: Suggestion,
		Tickets: Ticket,
		Users: User,
		Warnings: Warning,
	} as const);

	readonly log: Logger;
	readonly cache: {
		readonly entryRequests: Map<string, EntryRequest>;
		readonly guildStatistics: Map<string, GuildStatistics>;
		readonly guilds: Map<string, Guild>;
		readonly praisesByAuthor: Map<string, Map<string, Praise>>;
		readonly praisesByTarget: Map<string, Map<string, Praise>>;
		readonly reports: Map<string, Report>;
		readonly resources: Map<string, Resource>;
		readonly suggestions: Map<string, Suggestion>;
		readonly tickets: Map<string, Ticket>;
		readonly users: Map<string, User>;
		readonly warningsByTarget: Map<string, Map<string, Warning>>;
	};

	readonly #environment: Environment;
	readonly #adapter: DatabaseAdapter;

	get conventionsFor(): DatabaseAdapter["conventionsFor"] {
		return this.#adapter.conventionsFor.bind(this.#adapter);
	}

	get withSession(): <T>(callback: (session: DocumentSession) => T | Promise<T>) => Promise<T> {
		return (callback) => this.#adapter.withSession(callback, { environment: this.#environment, database: this });
	}

	constructor({ environment, log, adapter }: { environment: Environment; log: Logger; adapter: DatabaseAdapter }) {
		this.log = log;
		this.cache = {
			entryRequests: new Map(),
			guildStatistics: new Map(),
			guilds: new Map(),
			praisesByAuthor: new Map(),
			praisesByTarget: new Map(),
			reports: new Map(),
			resources: new Map(),
			suggestions: new Map(),
			tickets: new Map(),
			users: new Map(),
			warningsByTarget: new Map(),
		};

		this.#environment = environment;
		this.#adapter = adapter;
	}

	static async create({ environment }: { environment: Environment }): Promise<DatabaseStore> {
		const log = Logger.create({ identifier: "Client/DatabaseStore", isDebug: environment.isDebug });

		let adapter: DatabaseAdapter | undefined;
		switch (environment.databaseSolution) {
			case "mongodb": {
				adapter = MongoDBAdapter.tryCreate({ environment, log });
				break;
			}
			case "ravendb": {
				adapter = await RavenDBAdapter.tryCreate({ environment, log });
				break;
			}
			case "couchdb": {
				adapter = CouchDBAdapter.tryCreate({ environment, log });
				break;
			}
			case "rethinkdb": {
				adapter = RethinkDBAdapter.tryCreate({ environment, log });
				break;
			}
		}

		if (adapter === undefined) {
			if (environment.databaseSolution === undefined) {
				log.error(
					"`DATABASE_SOLUTION` was not provided. If this was intentional, explicitly define `DATABASE_SOLUTION` as 'none'.",
				);
			}

			log.info("Logos is running in memory. Data will not persist in-between sessions.");

			adapter = new InMemoryAdapter({ environment });
		}

		return new DatabaseStore({ environment, log, adapter });
	}

	static getModelClassByCollection({ collection }: { collection: Collection }): ModelConstructor {
		return DatabaseStore.#classes[collection];
	}

	async setup({ prefetchDocuments }: { prefetchDocuments: boolean }): Promise<void> {
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

		const totalCount = collections.map((documents) => documents.length).reduce((a, b) => a + b);
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
			this.cacheDocuments<Model>(documents);
		}
	}

	cacheDocuments<M extends Model>(documents: M[]): void {
		if (documents.length === 0) {
			return;
		}

		this.log.debug(`Caching ${documents.length} documents...`);

		for (const document of documents) {
			this.cacheDocument(document);
		}
	}

	cacheDocument(document: any): void {
		switch (true) {
			case document instanceof EntryRequest: {
				this.cache.entryRequests.set(document.partialId, document);
				break;
			}
			case document instanceof GuildStatistics: {
				this.cache.guildStatistics.set(document.partialId, document);
				break;
			}
			case document instanceof Guild: {
				this.cache.guilds.set(document.partialId, document);
				break;
			}
			case document instanceof Praise: {
				if (this.cache.praisesByAuthor.has(document.authorId)) {
					this.cache.praisesByAuthor.get(document.authorId)?.set(document.partialId, document);
				} else {
					this.cache.praisesByAuthor.set(document.authorId, new Map([[document.partialId, document]]));
				}

				if (this.cache.praisesByTarget.has(document.targetId)) {
					this.cache.praisesByTarget.get(document.targetId)?.set(document.partialId, document);
				} else {
					this.cache.praisesByTarget.set(document.targetId, new Map([[document.partialId, document]]));
				}

				break;
			}
			case document instanceof Report: {
				this.cache.reports.set(document.partialId, document);
				break;
			}
			case document instanceof Resource: {
				this.cache.resources.set(document.partialId, document);
				break;
			}
			case document instanceof Suggestion: {
				this.cache.suggestions.set(document.partialId, document);
				break;
			}
			case document instanceof Ticket: {
				this.cache.tickets.set(document.partialId, document);
				break;
			}
			case document instanceof User: {
				this.cache.users.set(document.partialId, document);
				break;
			}
			case document instanceof Warning: {
				if (this.cache.warningsByTarget.has(document.targetId)) {
					this.cache.warningsByTarget.get(document.targetId)?.set(document.partialId, document);
				} else {
					this.cache.warningsByTarget.set(document.targetId, new Map([[document.partialId, document]]));
				}
				break;
			}
		}
	}

	unloadDocument(document: any): void {
		switch (true) {
			case document instanceof EntryRequest: {
				this.cache.entryRequests.delete(document.partialId);
				break;
			}
			case document instanceof GuildStatistics: {
				this.cache.guildStatistics.delete(document.partialId);
				break;
			}
			case document instanceof Guild: {
				this.cache.guilds.delete(document.partialId);
				break;
			}
			case document instanceof Praise: {
				if (this.cache.praisesByAuthor.has(document.authorId)) {
					this.cache.praisesByAuthor.get(document.authorId)?.delete(document.partialId);
				}

				if (this.cache.praisesByTarget.has(document.targetId)) {
					this.cache.praisesByTarget.get(document.targetId)?.delete(document.partialId);
				}

				break;
			}
			case document instanceof Report: {
				this.cache.reports.delete(document.partialId);
				break;
			}
			case document instanceof Resource: {
				this.cache.resources.delete(document.partialId);
				break;
			}
			case document instanceof Suggestion: {
				this.cache.suggestions.delete(document.partialId);
				break;
			}
			case document instanceof Ticket: {
				this.cache.tickets.delete(document.partialId);
				break;
			}
			case document instanceof User: {
				this.cache.users.delete(document.partialId);
				break;
			}
			case document instanceof Warning: {
				if (this.cache.warningsByTarget.has(document.targetId)) {
					this.cache.warningsByTarget.get(document.targetId)?.delete(document.partialId);
				}
				break;
			}
		}
	}
}

export { DatabaseStore };
