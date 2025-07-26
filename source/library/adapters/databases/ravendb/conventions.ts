import { type Collection, isValidCollection } from "rost:constants/database";
import { DocumentConventions } from "rost/adapters/databases/adapter";
import type { RavenDBDocument, RavenDBDocumentMetadataContainer } from "rost/adapters/databases/ravendb/document";
import type { IdentifierDataOrMetadata, Model } from "rost/models/model";
import { DatabaseStore } from "rost/stores/database";

class RavenDBDocumentConventions extends DocumentConventions<RavenDBDocumentMetadataContainer> {
	get id(): string {
		return this.document["@metadata"]["@id"];
	}

	get revision(): string | undefined {
		return this.document["@metadata"]["@change-vector"];
	}

	set revision(value: string) {
		this.document["@metadata"]["@change-vector"] = value;
	}

	get isDeleted(): boolean | undefined {
		return this.document["@metadata"]["@is-deleted"];
	}

	set isDeleted(value: boolean) {
		this.document["@metadata"]["@is-deleted"] = value;
	}

	static instantiateModel<M extends Model>(database: DatabaseStore, payload: RavenDBDocument): M {
		if (!isValidCollection(payload["@metadata"]["@collection"])) {
			throw new Error(
				`Document ${payload.id} is part of an unknown collection: '${payload["@metadata"]["@collection"]}'`,
			);
		}

		const ModelClass = DatabaseStore.getModelClassByCollection({
			collection: payload["@metadata"]["@collection"],
		});

		return new ModelClass(database, payload) as M;
	}

	hasMetadata(data: IdentifierDataOrMetadata<Model, RavenDBDocumentMetadataContainer>): boolean {
		return "@metadata" in data;
	}

	buildMetadata({ id, collection }: { id: string; collection: Collection }): RavenDBDocumentMetadataContainer {
		return { "@metadata": { "@id": id, "@collection": collection } };
	}
}

export { RavenDBDocumentConventions };
