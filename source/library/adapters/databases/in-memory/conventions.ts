import type { Collection } from "rost:constants/database";
import { DocumentConventions } from "rost/adapters/databases/adapter";
import type { InMemoryDocumentMetadata } from "rost/adapters/databases/in-memory/document";
import type { IdentifierDataOrMetadata, Model } from "rost/models/model";

class InMemoryDocumentConventions extends DocumentConventions<InMemoryDocumentMetadata> {
	get id(): string {
		return this.document._id;
	}

	get isDeleted(): boolean | undefined {
		return this.document._isDeleted;
	}

	set isDeleted(value: boolean) {
		this.document._isDeleted = value;
	}

	hasMetadata(data: IdentifierDataOrMetadata<Model, InMemoryDocumentMetadata>): boolean {
		return "_id" in data;
	}

	buildMetadata({ id, collection: _ }: { id: string; collection: Collection }): InMemoryDocumentMetadata {
		return { _id: id };
	}
}

export { InMemoryDocumentConventions };
