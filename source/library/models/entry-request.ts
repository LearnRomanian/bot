import type { Client } from "rost/client";
import type { EntryRequestDocument, VoteVerdict } from "rost/models/documents/entry-request";
import {
	type ClientOrDatabaseStore,
	type CreateModelOptions,
	EntryRequestModel,
	type IdentifierData,
	Model,
} from "rost/models/model";
import type { DatabaseStore } from "rost/stores/database";

type VoteType = "for" | "against";

type CreateEntryRequestOptions = CreateModelOptions<EntryRequest, EntryRequestDocument, "requestedRoleId" | "formData">;

interface EntryRequest extends EntryRequestDocument {}
class EntryRequest extends EntryRequestModel {
	readonly createdAt: number;

	get guildId(): string {
		return this.idParts[0];
	}

	get authorId(): string {
		return this.idParts[1];
	}

	get votersFor(): string[] {
		return this.votes?.for ?? [];
	}

	get votersAgainst(): string[] {
		return this.votes?.against ?? [];
	}

	constructor(
		database: DatabaseStore,
		{
			createdAt,
			requestedRoleId,
			formData,
			isResolved,
			forcedVerdict,
			ticketChannelId,
			votes,
			...data
		}: CreateEntryRequestOptions,
	) {
		super(database, data, { collection: "EntryRequests" });

		this.createdAt = createdAt ?? Date.now();
		this.requestedRoleId = requestedRoleId;
		this.formData = formData;
		this.isResolved = isResolved ?? false;
		this.forcedVerdict = forcedVerdict;
		this.ticketChannelId = ticketChannelId;
		this.votes = votes;
	}

	static async get(client: Client, data: IdentifierData<EntryRequest>): Promise<EntryRequest | undefined> {
		const partialId = Model.buildPartialId(data);
		if (client.documents.entryRequests.has(partialId)) {
			return client.documents.entryRequests.get(partialId)!;
		}

		return client.database.withSession((session) => {
			return session.get<EntryRequest>(Model.buildId(data, { collection: "EntryRequests" }));
		});
	}

	static async getAll(
		clientOrDatabase: ClientOrDatabaseStore,
		clauses?: { where?: Partial<IdentifierData<EntryRequest>> },
	): Promise<EntryRequest[]> {
		return Model.all<EntryRequest>(clientOrDatabase, {
			collection: "EntryRequests",
			where: { guildId: undefined, authorId: undefined, ...clauses?.where },
		});
	}

	static async create(client: Client, data: CreateEntryRequestOptions): Promise<EntryRequest> {
		const entryRequestDocument = new EntryRequest(client.database, data);

		await entryRequestDocument.create(client);

		return entryRequestDocument;
	}

	getUserVote({ userId }: { userId: string }): VoteType | undefined {
		if (this.votes?.for?.includes(userId)) {
			return "for";
		}

		if (this.votes?.against?.includes(userId)) {
			return "against";
		}

		return undefined;
	}

	addVote({ userId, vote }: { userId: string; vote: VoteType }): void {
		const previousVote = this.getUserVote({ userId });
		if (previousVote !== undefined) {
			if (vote === previousVote) {
				return;
			}

			this.removeVote({ userId, vote: previousVote });
		}

		switch (vote) {
			case "for": {
				if (this.votes === undefined) {
					this.votes = { for: [userId] };
				} else if (this.votes.for === undefined) {
					this.votes.for = [userId];
				} else {
					this.votes.for.push(userId);
				}
				break;
			}
			case "against": {
				if (this.votes === undefined) {
					this.votes = { against: [userId] };
				} else if (this.votes.against === undefined) {
					this.votes.against = [userId];
				} else {
					this.votes.against.push(userId);
				}
				break;
			}
		}
	}

	removeVote({ userId, vote }: { userId: string; vote: VoteType }): void {
		switch (vote) {
			case "for": {
				this.votes!.for!.splice(this.votes!.for!.indexOf(userId), 1);
				break;
			}
			case "against": {
				this.votes!.against!.splice(this.votes!.against!.indexOf(userId), 1);
				break;
			}
		}
	}

	getVerdict({
		requiredFor,
		requiredAgainst,
	}: { requiredFor: number; requiredAgainst: number }): VoteVerdict | undefined {
		if (this.forcedVerdict !== undefined) {
			return this.forcedVerdict.verdict;
		}

		if (this.votersFor.length >= requiredFor) {
			return "accepted";
		}

		if (this.votersAgainst.length >= requiredAgainst) {
			return "rejected";
		}

		return undefined;
	}

	forceVerdict(forcedVerdict: EntryRequest["forcedVerdict"]): void {
		this.forcedVerdict = forcedVerdict;
	}
}

export { EntryRequest };
export type { CreateEntryRequestOptions, VoteType };
