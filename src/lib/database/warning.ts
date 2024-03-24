import { Rule } from "logos:constants/rules";
import { Client } from "logos/client";
import { ClientOrDatabase, IdentifierData, MetadataOrIdentifierData, Model } from "logos/database/model";

// TODO(vxern): This needs a guild in the ID as well.
class Warning extends Model<{ idParts: ["authorId", "targetId", "createdAt"] }> {
	get authorId(): string {
		return this.idParts[0];
	}

	get targetId(): string {
		return this.idParts[1];
	}

	get createdAt(): number {
		return Number(this.idParts[2]);
	}

	readonly reason: string;

	/** @since v3.37.0 */
	rule?: Rule;

	constructor({ reason, rule, ...data }: { reason: string; rule?: Rule } & MetadataOrIdentifierData<Warning>) {
		super({
			"@metadata": Model.buildMetadata(data, { collection: "Warnings" }),
		});

		this.reason = reason;
		this.rule = rule;
	}

	static async getAll(
		clientOrDatabase: ClientOrDatabase,
		clauses?: { where?: Partial<IdentifierData<Warning>> },
	): Promise<Warning[]> {
		return await Model.all<Warning>(clientOrDatabase, {
			collection: "Warnings",
			where: Object.assign({ ...clauses?.where }, { authorId: undefined, targetId: undefined, createdAt: undefined }),
		});
	}

	static async create(
		client: Client,
		data: Omit<IdentifierData<Warning>, "createdAt"> & { reason: string; rule?: Rule },
	): Promise<Warning> {
		const warningDocument = new Warning({ ...data, createdAt: Date.now().toString() });

		await warningDocument.create(client);

		return warningDocument;
	}

	static async getActiveWarnings(
		clientOrDatabase: ClientOrDatabase,
		{ timeRangeMilliseconds }: { timeRangeMilliseconds: number },
	): Promise<Warning[]> {
		const warnings = await Warning.getAll(clientOrDatabase);

		const now = Date.now();

		return warnings.filter((warning) => now - warning.createdAt <= timeRangeMilliseconds);
	}
}

export { Warning };
export type { Rule };
