import type { Client } from "rost/client";
import type { UserDocument } from "rost/models/documents/user";
import { type CreateModelOptions, Model, UserModel } from "rost/models/model";
import type { DatabaseStore } from "rost/stores/database";

type AuthorisationStatus = "authorised" | "rejected";

type CreateUserOptions = CreateModelOptions<User, UserDocument, "account">;

interface User extends UserDocument {}
class User extends UserModel {
	readonly createdAt: number;

	get userId(): string {
		return this.idParts[0];
	}

	constructor(database: DatabaseStore, { createdAt, account, ...data }: CreateUserOptions) {
		super(database, data, { collection: "Users" });

		this.createdAt = createdAt ?? Date.now();
		this.account = account;
	}

	static async getOrCreate(client: Client, data: CreateUserOptions): Promise<User> {
		const partialId = Model.buildPartialId<User>(data);
		if (client.documents.users.has(partialId)) {
			return client.documents.users.get(partialId)!;
		}

		return client.database.withSession(async (session) => {
			const userDocument = await session.get<User>(Model.buildId<User>(data, { collection: "Users" }));
			if (userDocument !== undefined) {
				return userDocument;
			}

			return session.set(new User(client.database, data));
		});
	}

	isAuthorisedOn({ guildId }: { guildId: string }): boolean {
		if (this.account?.authorisedOn === undefined) {
			return false;
		}

		return this.account.authorisedOn.includes(guildId);
	}

	isRejectedOn({ guildId }: { guildId: string }): boolean {
		if (this.account?.rejectedOn === undefined) {
			return false;
		}

		return this.account.rejectedOn.includes(guildId);
	}

	getAuthorisationStatus({ guildId }: { guildId: string }): AuthorisationStatus | undefined {
		if (this.isAuthorisedOn({ guildId })) {
			return "authorised";
		}

		if (this.isRejectedOn({ guildId })) {
			return "rejected";
		}

		return undefined;
	}

	setAuthorisationStatus({ guildId, status }: { guildId: string; status: AuthorisationStatus }): void {
		const previousState = this.getAuthorisationStatus({ guildId });
		if (previousState !== undefined) {
			if (previousState === "authorised") {
				return;
			}

			this.clearAuthorisationStatus({ guildId, status: previousState });
		}

		switch (status) {
			case "authorised": {
				if (this.account === undefined) {
					this.account = { authorisedOn: [guildId] };
					return;
				}

				if (this.account.authorisedOn === undefined) {
					this.account.authorisedOn = [guildId];
				}

				this.account.authorisedOn.push(guildId);
				break;
			}
			case "rejected": {
				if (this.account === undefined) {
					this.account = { rejectedOn: [guildId] };
					return;
				}

				if (this.account.rejectedOn === undefined) {
					this.account.rejectedOn = [guildId];
					return;
				}

				this.account.rejectedOn.push(guildId);
				break;
			}
		}
	}

	clearAuthorisationStatus({ guildId, status }: { guildId: string; status: AuthorisationStatus }): void {
		switch (status) {
			case "authorised": {
				this.account!.authorisedOn!.splice(this.account!.authorisedOn!.indexOf(guildId), 1);
				break;
			}
			case "rejected": {
				this.account!.rejectedOn!.splice(this.account!.rejectedOn!.indexOf(guildId), 1);
				break;
			}
		}
	}
}

export { User };
export type { CreateUserOptions };
