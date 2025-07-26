import type { Collection } from "rost:constants/database";
import type nano from "nano";
import { DocumentSession } from "rost/adapters/databases/adapter";
import { CouchDBDocumentConventions } from "rost/adapters/databases/couchdb/conventions";
import type { CouchDBDocument } from "rost/adapters/databases/couchdb/document";
import { CouchDBDocumentQuery } from "rost/adapters/databases/couchdb/query";
import type { Model } from "rost/models/model";
import type { DatabaseStore } from "rost/stores/database";

class CouchDBDocumentSession extends DocumentSession {
	readonly #documents: nano.DocumentScope<unknown>;

	constructor({ database, documents }: { database: DatabaseStore; documents: nano.DocumentScope<unknown> }) {
		super({ identifier: "CouchDB", database });

		this.#documents = documents;
	}

	async load<M extends Model>(id: string): Promise<M | undefined> {
		const rawDocument = await this.#documents.get(id).catch((error) => {
			if (error.statusCode !== 404) {
				this.log.error(error, `Failed to get document ${id}.`);
			}

			return undefined;
		});
		if (rawDocument === undefined) {
			return undefined;
		}

		return CouchDBDocumentConventions.instantiateModel<M>(this.database, rawDocument as CouchDBDocument);
	}

	async loadMany<M extends Model>(ids: string[]): Promise<(M | undefined)[]> {
		if (ids.length === 0) {
			return [];
		}

		const response = await this.#documents
			.fetch({ keys: ids }, { conflicts: false, include_docs: true })
			.catch((error) => {
				this.log.error(error, `Failed to get ${ids.length} documents.`);
				return undefined;
			});
		if (response === undefined) {
			return [];
		}

		const documents: (M | undefined)[] = [];
		for (const result of response.rows) {
			if (result.error !== undefined) {
				documents.push(undefined);
				continue;
			}

			const row = result as nano.DocumentResponseRow<CouchDBDocument>;
			const rowDocument = row.doc!;

			documents.push(CouchDBDocumentConventions.instantiateModel<M>(this.database, rowDocument));
		}

		return documents;
	}

	async store<M extends Model>(document: M): Promise<void> {
		const existingDocument = await this.load(document.id);
		if (existingDocument !== undefined) {
			document.revision = existingDocument.revision!;
		}

		const result = await this.#documents
			.insert(document as unknown as nano.IdentifiedDocument, { rev: document.revision })
			.catch((error) => {
				// Conflict during insertion. This happens when a document is attempted to be saved twice at the same
				// time.
				if (error.statusCode === 409) {
					this.log.debug(`Encountered conflict when saving document ${document.id}. Ignoring...`);
					return undefined;
				}

				this.log.error(error, `Failed to store document ${document.id}.`);
				return undefined;
			});
		if (result === undefined) {
			return;
		}

		if (result.rev !== document.revision) {
			document.revision = result.rev;
		}
	}

	query<M extends Model>({ collection }: { collection: Collection }): CouchDBDocumentQuery<M> {
		return new CouchDBDocumentQuery<M>({ documents: this.#documents, session: this, collection });
	}
}

export { CouchDBDocumentSession };
