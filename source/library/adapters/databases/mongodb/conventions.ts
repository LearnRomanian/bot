import type { Collection } from "rost:constants/database";
import { DocumentConventions } from "rost/adapters/databases/adapter";
import type { MongoDBDocument, MongoDBDocumentMetadata } from "rost/adapters/databases/mongodb/document";
import { type IdentifierDataOrMetadata, Model } from "rost/models/model";
import { DatabaseStore } from "rost/stores/database";

class MongoDBDocumentConventions extends DocumentConventions<MongoDBDocumentMetadata> {
	get id(): string {
		return this.document._id;
	}

	get isDeleted(): boolean | undefined {
		return this.document._isDeleted;
	}

	set isDeleted(value: boolean) {
		this.document._isDeleted = value;
	}

	static instantiateModel<M extends Model>(database: DatabaseStore, payload: MongoDBDocument): M {
		const [collection, _] = Model.getDataFromId(payload._id);
		const ModelClass = DatabaseStore.getModelClassByCollection({ collection: collection });

		return new ModelClass(database, payload) as M;
	}

	hasMetadata(data: IdentifierDataOrMetadata<Model, MongoDBDocumentMetadata>): boolean {
		return "_id" in data;
	}

	buildMetadata({ id, collection: _ }: { id: string; collection: Collection }): MongoDBDocumentMetadata {
		return { _id: id };
	}
}

export { MongoDBDocumentConventions };
