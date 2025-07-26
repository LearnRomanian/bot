import type { Collection } from "rost:constants/database";
import type pino from "pino";
import { DatabaseAdapter, type DocumentConventions } from "rost/adapters/databases/adapter";
import { InMemoryDocumentConventions } from "rost/adapters/databases/in-memory/conventions";
import type { InMemoryDocumentMetadata } from "rost/adapters/databases/in-memory/document";
import { InMemoryDocumentSession } from "rost/adapters/databases/in-memory/session";
import type { IdentifierDataOrMetadata, Model } from "rost/models/model";
import type { DatabaseStore } from "rost/stores/database";

class InMemoryAdapter extends DatabaseAdapter {
	constructor({ log }: { log: pino.Logger }) {
		super({ identifier: "InMemory", log });
	}

	conventionsFor({
		document,
		data,
		collection,
	}: {
		document: Model;
		data: IdentifierDataOrMetadata<Model, InMemoryDocumentMetadata>;
		collection: Collection;
	}): DocumentConventions {
		return new InMemoryDocumentConventions({ document, data, collection });
	}

	openSession({ database }: { database: DatabaseStore }): InMemoryDocumentSession {
		return new InMemoryDocumentSession({ database });
	}
}

export { InMemoryAdapter };
