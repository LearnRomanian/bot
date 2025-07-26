import { DocumentQuery } from "rost/adapters/databases/adapter";
import type { Model } from "rost/models/model";

class InMemoryDocumentQuery<M extends Model> extends DocumentQuery<M> {
	#documents: Map<string, M>;

	constructor({ documents }: { documents: Map<string, M> }) {
		super();

		this.#documents = documents;
	}

	#whereIdRegex(pattern: RegExp): this {
		const newDocuments = new Map<string, M>();
		for (const [partialId, document] of this.#documents) {
			if (pattern.test(document.id)) {
				newDocuments.set(partialId, document);
			}
		}

		this.#documents = newDocuments;
		return this;
	}

	whereRegex(property: string, pattern: RegExp): this {
		if (property === "id") {
			return this.#whereIdRegex(pattern);
		}

		const newDocuments = new Map<string, M>();
		for (const [partialId, document] of this.#documents) {
			if (property in document) {
				continue;
			}

			const value = document[property as keyof typeof document] as unknown;
			if (typeof value === "string" && pattern.test(value.toString())) {
				newDocuments.set(partialId, document);
			}
		}

		this.#documents = newDocuments;
		return this;
	}

	#whereIdEquals(value: unknown): this {
		const newDocuments = new Map<string, M>();
		for (const [partialId, document] of this.#documents) {
			if (value === document.id) {
				newDocuments.set(partialId, document);
			}
		}

		this.#documents = newDocuments;
		return this;
	}

	whereEquals(property: string, value: unknown): this {
		if (property === "id") {
			return this.#whereIdEquals(value);
		}

		const newDocuments = new Map<string, M>();
		for (const [partialId, document] of this.#documents) {
			if (property in document) {
				continue;
			}

			if (value === document[property as keyof typeof document]) {
				newDocuments.set(partialId, document);
			}
		}

		this.#documents = newDocuments;
		return this;
	}

	async execute(): Promise<M[]> {
		return Array.from(this.#documents.values());
	}
}

export { InMemoryDocumentQuery };
