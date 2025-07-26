import type { Client } from "rost/client";
import type { PraiseDocument } from "rost/models/documents/praise";
import {
	type ClientOrDatabaseStore,
	type CreateModelOptions,
	type IdentifierData,
	Model,
	PraiseModel,
} from "rost/models/model";
import type { DatabaseStore } from "rost/stores/database";

type CreatePraiseOptions = CreateModelOptions<Praise, PraiseDocument>;

interface Praise extends PraiseDocument {}
class Praise extends PraiseModel {
	get guildId(): string {
		return this.idParts[0];
	}

	get authorId(): string {
		return this.idParts[1];
	}

	get targetId(): string {
		return this.idParts[2];
	}

	get createdAt(): number {
		return Number(this.idParts[3]);
	}

	constructor(database: DatabaseStore, { comment, ...data }: CreatePraiseOptions) {
		super(database, data, { collection: "Praises" });

		this.comment = comment;
	}

	static async getAll(
		clientOrDatabase: ClientOrDatabaseStore,
		clauses?: { where?: Partial<IdentifierData<Praise>> },
	): Promise<Praise[]> {
		return Model.all<Praise>(clientOrDatabase, {
			collection: "Praises",
			where: {
				guildId: undefined,
				authorId: undefined,
				targetId: undefined,
				createdAt: undefined,
				...clauses?.where,
			},
		});
	}

	static async create(client: Client, data: Omit<CreatePraiseOptions, "createdAt">): Promise<Praise> {
		const praiseDocument = new Praise(client.database, { ...data, createdAt: Date.now().toString() });
		await praiseDocument.create(client);

		return praiseDocument;
	}
}

export { Praise };
export type { CreatePraiseOptions };
