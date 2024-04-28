import { Client } from "logos/client";
import { ClientOrDatabaseStore, IdentifierData, Model } from "logos/database/model";
import { DatabaseStore } from "logos/stores/database";

type TicketType = "standalone" | "inquiry";

interface TicketFormData {
	readonly topic: string;
}

class Ticket extends Model<{ collection: "Tickets"; idParts: ["guildId", "authorId", "channelId"] }> {
	get guildId(): string {
		return this.idParts[0];
	}

	get authorId(): string {
		return this.idParts[1];
	}

	get channelId(): string {
		return this.idParts[2];
	}

	readonly createdAt: number;
	readonly type: TicketType;
	readonly formData: TicketFormData;

	isResolved: boolean;

	constructor(
		database: DatabaseStore,
		{
			createdAt,
			type,
			formData,
			isResolved,
			...data
		}: {
			createdAt?: number;
			type: TicketType;
			formData: TicketFormData;
			isResolved?: boolean;
		} & IdentifierData<Ticket>,
	) {
		super(database, data, { collection: "Tickets" });

		this.createdAt = createdAt ?? Date.now();
		this.type = type;
		this.formData = formData;
		this.isResolved = isResolved ?? false;
	}

	static async getAll(
		clientOrDatabase: ClientOrDatabaseStore,
		clauses?: { where?: Partial<IdentifierData<Ticket>> },
	): Promise<Ticket[]> {
		return await Model.all<Ticket>(clientOrDatabase, {
			collection: "Tickets",
			where: Object.assign({ ...clauses?.where }, { guildId: undefined, authorId: undefined, channelId: undefined }),
		});
	}

	static async create(
		client: Client,
		data: IdentifierData<Ticket> & { type: TicketType; formData: TicketFormData },
	): Promise<Ticket> {
		const ticketDocument = new Ticket(client.database, data);

		await ticketDocument.create(client);

		return ticketDocument;
	}
}

export { Ticket };
export type { TicketType, TicketFormData };
