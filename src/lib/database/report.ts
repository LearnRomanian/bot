import { Client } from "../client";
import { ClientOrDatabase, IdentifierData, MetadataOrIdentifierData, Model } from "./model";

interface ReportFormData {
	readonly reason: string;
	readonly users: string;
	messageLink?: string;
}

class Report extends Model<{ idParts: ["guildId", "authorId", "createdAt"] }> {
	get guildId(): string {
		return this.idParts[0];
	}

	get authorId(): string {
		return this.idParts[1];
	}

	get createdAt(): number {
		return Number(this.idParts[2]);
	}

	// TODO(vxern): Rename this to `formData`.
	readonly answers: ReportFormData;

	isResolved: boolean;

	constructor({
		answers,
		isResolved,
		...data
	}: { answers: ReportFormData; isResolved?: boolean } & MetadataOrIdentifierData<Report>) {
		super({
			"@metadata": Model.buildMetadata(data, { collection: "Reports" }),
		});

		this.answers = answers;
		this.isResolved = isResolved ?? false;
	}

	static async getAll(
		clientOrDatabase: ClientOrDatabase,
		clauses?: { where?: Partial<IdentifierData<Report>> },
	): Promise<Report[]> {
		const result = await Model.all<Report>(clientOrDatabase, {
			collection: "Reports",
			where: Object.assign({ ...clauses?.where }, { guildId: undefined, authorId: undefined, createdAt: undefined }),
		});

		return result;
	}

	static async create(client: Client, data: IdentifierData<Report> & { answers: ReportFormData }): Promise<Report> {
		const reportDocument = new Report(data);

		await reportDocument.create(client);

		return reportDocument;
	}
}

export { Report };
export type { ReportFormData };
