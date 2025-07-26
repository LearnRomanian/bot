import type { Client } from "rost/client";
import type { ResourceDocument } from "rost/models/documents/resource";
import {
	type ClientOrDatabaseStore,
	type CreateModelOptions,
	type IdentifierData,
	Model,
	ResourceModel,
} from "rost/models/model";
import type { DatabaseStore } from "rost/stores/database";

type CreateResourceOptions = CreateModelOptions<Resource, ResourceDocument, "formData">;

interface Resource extends ResourceDocument {}
class Resource extends ResourceModel {
	get guildId(): string {
		return this.idParts[0];
	}

	get authorId(): string {
		return this.idParts[1];
	}

	get createdAt(): number {
		return Number(this.idParts[2]);
	}

	constructor(database: DatabaseStore, { formData, isResolved, ...data }: CreateResourceOptions) {
		super(database, data, { collection: "Resources" });

		this.formData = formData;
		this.isResolved = isResolved ?? false;
	}

	static getAll(
		clientOrDatabase: ClientOrDatabaseStore,
		clauses?: { where?: Partial<IdentifierData<Resource>> },
	): Promise<Resource[]> {
		return Model.all<Resource>(clientOrDatabase, {
			collection: "Resources",
			where: { guildId: undefined, authorId: undefined, createdAt: undefined, ...clauses?.where },
		});
	}

	static async create(client: Client, data: Omit<CreateResourceOptions, "createdAt">): Promise<Resource> {
		const resourceDocument = new Resource(client.database, { ...data, createdAt: Date.now().toString() });
		await resourceDocument.create(client);

		return resourceDocument;
	}
}

export { Resource };
export type { CreateResourceOptions };
