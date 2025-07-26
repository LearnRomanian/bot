import type { DatabaseMetadataDocument } from "rost/models/documents/database-metadata";
import {
	type ClientOrDatabaseStore,
	type CreateModelOptions,
	DatabaseMetadataModel,
	Model,
	getDatabase,
} from "rost/models/model";
import type { DatabaseStore } from "rost/stores/database";

type CreateDatabaseMetadataOptions = CreateModelOptions<DatabaseMetadata, DatabaseMetadataDocument, "migrations">;

interface DatabaseMetadata extends DatabaseMetadataDocument {}
class DatabaseMetadata extends DatabaseMetadataModel {
	readonly createdAt: number;

	constructor(database: DatabaseStore, { createdAt, migrations, ...data }: CreateDatabaseMetadataOptions) {
		super(database, data, { collection: "DatabaseMetadata" });

		this.createdAt = createdAt ?? Date.now();
		this.migrations = migrations;
	}

	static async get(clientOrDatabase: ClientOrDatabaseStore): Promise<DatabaseMetadata | undefined> {
		return getDatabase(clientOrDatabase).withSession(async (session) => {
			return session.get<DatabaseMetadata>(
				Model.buildId<DatabaseMetadata>({}, { collection: "DatabaseMetadata" }),
			);
		});
	}

	static async create(
		clientOrDatabase: ClientOrDatabaseStore,
		data: CreateDatabaseMetadataOptions,
	): Promise<DatabaseMetadata> {
		const database = getDatabase(clientOrDatabase);
		return database.withSession(async (session) => {
			return session.set(new DatabaseMetadata(database, data));
		});
	}

	static async getOrCreate(
		clientOrDatabase: ClientOrDatabaseStore,
		data: CreateDatabaseMetadataOptions,
	): Promise<DatabaseMetadata> {
		const databaseMetadataDocument = await DatabaseMetadata.get(clientOrDatabase);
		if (databaseMetadataDocument !== undefined) {
			return databaseMetadataDocument;
		}

		return DatabaseMetadata.create(clientOrDatabase, data);
	}
}

export { DatabaseMetadata };
export type { CreateDatabaseMetadataOptions };
