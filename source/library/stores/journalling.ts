import type pino from "pino";
import type { Client } from "rost/client";
import { Collector } from "rost/collectors";
import loggers from "rost/stores/journalling/loggers";

type Events = Rost.Events & Discord.Events;

class JournallingStore {
	readonly log: pino.Logger;

	readonly #client: Client;
	readonly #guildBanAddCollector: Collector<"guildBanAdd">;
	readonly #guildBanRemoveCollector: Collector<"guildBanRemove">;
	readonly #guildMemberAddCollector: Collector<"guildMemberAdd">;
	readonly #guildMemberRemoveCollector: Collector<"guildMemberRemove">;
	readonly #messageDeleteCollector: Collector<"messageDelete">;
	readonly #messageDeleteBulkCollector: Collector<"messageDeleteBulk">;
	readonly #messageUpdateCollector: Collector<"messageUpdate">;

	constructor(client: Client) {
		this.log = client.log.child({ name: "JournallingStore" });

		this.#client = client;
		this.#guildBanAddCollector = new Collector();
		this.#guildBanRemoveCollector = new Collector();
		this.#guildMemberAddCollector = new Collector();
		this.#guildMemberRemoveCollector = new Collector();
		this.#messageDeleteCollector = new Collector();
		this.#messageDeleteBulkCollector = new Collector();
		this.#messageUpdateCollector = new Collector();
	}

	async setup(): Promise<void> {
		this.log.info("Setting up journalling store...");

		this.#guildBanAddCollector.onCollect(this.#guildBanAdd.bind(this));
		this.#guildBanRemoveCollector.onCollect(this.#guildBanRemove.bind(this));
		this.#guildMemberAddCollector.onCollect(this.#guildMemberAdd.bind(this));
		this.#guildMemberRemoveCollector.onCollect(this.#guildMemberRemove.bind(this));
		this.#messageDeleteCollector.onCollect(this.#messageDelete.bind(this));
		this.#messageDeleteBulkCollector.onCollect(this.#messageDeleteBulk.bind(this));
		this.#messageUpdateCollector.onCollect(this.#messageUpdate.bind(this));

		await this.#client.registerCollector("guildBanAdd", this.#guildBanAddCollector);
		await this.#client.registerCollector("guildBanRemove", this.#guildBanRemoveCollector);
		await this.#client.registerCollector("guildMemberAdd", this.#guildMemberAddCollector);
		await this.#client.registerCollector("guildMemberRemove", this.#guildMemberRemoveCollector);
		await this.#client.registerCollector("messageDelete", this.#messageDeleteCollector);
		await this.#client.registerCollector("messageDeleteBulk", this.#messageDeleteBulkCollector);
		await this.#client.registerCollector("messageUpdate", this.#messageUpdateCollector);

		this.log.info("Journalling store set up.");
	}

	teardown(): void {
		this.log.info("Tearing down journalling store...");

		this.#guildBanAddCollector.close();
		this.#guildBanRemoveCollector.close();
		this.#guildMemberAddCollector.close();
		this.#guildMemberRemoveCollector.close();
		this.#messageDeleteCollector.close();
		this.#messageDeleteBulkCollector.close();
		this.#messageUpdateCollector.close();

		this.log.info("Journalling store torn down.");
	}

	async tryLog<Event extends keyof Events>(
		event: Event,
		{ guildId, journalling = true, args }: { guildId: bigint; journalling?: boolean; args: Events[Event] },
	): Promise<void> {
		if (!journalling) {
			this.#client.log.debug(
				`Event '${event}' happened on ${this.#client.diagnostics.guild(
					guildId,
				)}, but journalling for that feature is turned off. Ignoring...`,
			);
			return;
		}

		const guildDocument = this.#client.documents.guilds.get(guildId.toString());
		if (guildDocument === undefined) {
			return;
		}

		if (!guildDocument.hasEnabled("journalling")) {
			return;
		}

		const configuration = guildDocument.feature("journalling");

		const generateMessage = loggers[event];
		if (generateMessage === undefined) {
			return;
		}

		const message = await generateMessage(this.#client, args, { guildLocale: guildDocument.locales.source });
		if (message === undefined) {
			return;
		}

		await this.#client.bot.helpers
			.sendMessage(BigInt(configuration.channelId), message)
			.catch((error) =>
				this.log.warn(error, `Failed to log '${event}' event on ${this.#client.diagnostics.guild(guildId)}.`),
			);
	}

	static generateMessageLog(client: Client, { messages }: { messages: Rost.Message[] }): string {
		return messages.map((message) => JournallingStore.#messageLogEntry(client, message)).join("\n\n");
	}

	static #messageLogEntry(client: Client, message: Rost.Message): string {
		const postingTime = new Date(Discord.snowflakeToTimestamp(message.id)).toLocaleString();
		const username = client.diagnostics.user(message.author);

		let content: string;
		if (message.content !== undefined) {
			content = message.content
				.split("\n")
				.map((line) => `    ${line}`)
				.join("\n");
		} else if (message.embeds !== undefined && message.embeds.length > 0) {
			content = "[embeds]";
		} else {
			content = "[no message content]";
		}

		return `[${postingTime}] ${username}:\n\n${content}`;
	}

	async #guildBanAdd(user: Discord.User, guildId: bigint): Promise<void> {
		await this.tryLog("guildBanAdd", { guildId, args: [user, guildId] });
	}

	async #guildBanRemove(user: Discord.User, guildId: bigint): Promise<void> {
		await this.tryLog("guildBanRemove", { guildId, args: [user, guildId] });
	}

	async #guildMemberAdd(member: Discord.Member, user: Discord.User): Promise<void> {
		await this.tryLog("guildMemberAdd", { guildId: member.guildId, args: [member, user] });
	}

	async #guildMemberRemove(user: Discord.User, guildId: bigint): Promise<void> {
		const kickInformation = await this.#getKickInformation({ user, guildId });
		if (kickInformation !== undefined) {
			if (kickInformation.userId === null) {
				return;
			}

			const authorMember = this.#client.entities.members.get(guildId)?.get(BigInt(kickInformation.userId));
			if (authorMember === undefined) {
				return;
			}

			await this.tryLog("guildMemberKick", { guildId, args: [user, authorMember] });
			return;
		}

		await this.tryLog("guildMemberRemove", { guildId, args: [user, guildId] });
	}

	async #messageDelete(
		payload: Discord.Events["messageDelete"][0],
		message: Discord.Message | undefined,
	): Promise<void> {
		const guildId = payload.guildId;
		if (guildId === undefined) {
			return;
		}

		const resolvedMessage = this.#client.entities.messages.latest.get(payload.id);

		if (resolvedMessage?.author.id === this.#client.bot.id) {
			return;
		}

		await this.tryLog("messageDelete", { guildId, args: [payload, message] });
	}

	async #messageDeleteBulk(payload: Discord.Events["messageDeleteBulk"][0]): Promise<void> {
		const guildId = payload.guildId;
		if (guildId === undefined) {
			return;
		}

		await this.tryLog("messageDeleteBulk", { guildId, args: [payload] });
	}

	async #messageUpdate(message: Discord.Message): Promise<void> {
		const guildId = message.guildId;
		if (guildId === undefined) {
			return;
		}

		if (message.author.id === this.#client.bot.id) {
			return;
		}

		await this.tryLog("messageUpdate", { guildId, args: [message] });
	}

	async #getKickInformation({
		user,
		guildId,
	}: { user: Rost.User; guildId: bigint }): Promise<Discord.Camelize<Discord.DiscordAuditLogEntry> | undefined> {
		const now = Date.now();

		const guildDocument = this.#client.documents.guilds.get(guildId.toString());
		if (guildDocument === undefined) {
			return undefined;
		}

		if (!guildDocument.hasEnabled("journalling")) {
			return undefined;
		}

		const auditLog = await this.#client.bot.helpers
			.getAuditLog(guildId, { actionType: Discord.AuditLogEvents.MemberKick })
			.catch((error) => {
				this.log.warn(error, `Could not get audit log for ${this.#client.diagnostics.guild(guildId)}.`);
				return undefined;
			});
		if (auditLog === undefined) {
			return undefined;
		}

		return auditLog.auditLogEntries
			.filter((entry) => Discord.snowflakeToTimestamp(BigInt(entry.id)) >= now - constants.time.second * 5)
			.find((entry) => entry.targetId === user.id.toString());
	}
}

export { JournallingStore };
