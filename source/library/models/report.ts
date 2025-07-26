import type { Client } from "rost/client";
import type { ReportDocument } from "rost/models/documents/report";
import {
	type ClientOrDatabaseStore,
	type CreateModelOptions,
	type IdentifierData,
	Model,
	ReportModel,
} from "rost/models/model";
import type { DatabaseStore } from "rost/stores/database";

type CreateReportOptions = CreateModelOptions<Report, ReportDocument, "formData">;

interface Report extends ReportDocument {}
class Report extends ReportModel {
	get guildId(): string {
		return this.idParts[0];
	}

	get authorId(): string {
		return this.idParts[1];
	}

	get createdAt(): number {
		return Number(this.idParts[2]);
	}

	constructor(database: DatabaseStore, { formData, isResolved, ...data }: CreateReportOptions) {
		super(database, data, { collection: "Reports" });

		this.formData = formData;
		this.isResolved = isResolved ?? false;
	}

	static async getAll(
		clientOrDatabase: ClientOrDatabaseStore,
		clauses?: { where?: Partial<IdentifierData<Report>> },
	): Promise<Report[]> {
		return Model.all<Report>(clientOrDatabase, {
			collection: "Reports",
			where: { guildId: undefined, authorId: undefined, createdAt: undefined, ...clauses?.where },
		});
	}

	static async create(client: Client, data: Omit<CreateReportOptions, "createdAt">): Promise<Report> {
		const reportDocument = new Report(client.database, { ...data, createdAt: Date.now().toString() });
		await reportDocument.create(client);

		return reportDocument;
	}
}

export { Report };
export type { CreateReportOptions };
