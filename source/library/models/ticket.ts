import type { Client } from "rost/client";
import type { TicketDocument } from "rost/models/documents/ticket";
import {
	type ClientOrDatabaseStore,
	type CreateModelOptions,
	type IdentifierData,
	Model,
	TicketModel,
} from "rost/models/model";
import type { DatabaseStore } from "rost/stores/database";

type CreateTicketOptions = CreateModelOptions<Ticket, TicketDocument, "type" | "formData">;

interface Ticket extends TicketDocument {}
class Ticket extends TicketModel {
	readonly createdAt: number;

	get guildId(): string {
		return this.idParts[0];
	}

	get authorId(): string {
		return this.idParts[1];
	}

	get channelId(): string {
		return this.idParts[2];
	}

	constructor(database: DatabaseStore, { createdAt, type, formData, isResolved, ...data }: CreateTicketOptions) {
		super(database, data, { collection: "Tickets" });

		this.createdAt = createdAt ?? Date.now();
		this.type = type;
		this.formData = formData;
		this.isResolved = isResolved ?? false;
	}

	static getAll(
		clientOrDatabase: ClientOrDatabaseStore,
		clauses?: { where?: Partial<IdentifierData<Ticket>> },
	): Promise<Ticket[]> {
		return Model.all<Ticket>(clientOrDatabase, {
			collection: "Tickets",
			where: { guildId: undefined, authorId: undefined, channelId: undefined, ...clauses?.where },
		});
	}

	static async create(client: Client, data: CreateTicketOptions): Promise<Ticket> {
		const ticketDocument = new Ticket(client.database, data);
		await ticketDocument.create(client);

		return ticketDocument;
	}
}

export { Ticket };
export type { CreateTicketOptions };
