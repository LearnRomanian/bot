import { getLocalisationLocaleByLanguage } from "logos:constants/languages/localisation";
import type { Client } from "logos/client";
import { Collector } from "logos/collectors";
import { Logger } from "logos/logger";
import loggers from "logos/stores/journalling/loggers";

type Events = Logos.Events & Discord.Events;

class JournallingStore {
	readonly log: Logger;

	readonly #client: Client;
	readonly #guildBanAddCollector: Collector<"guildBanAdd">;
	readonly #guildBanRemoveCollector: Collector<"guildBanRemove">;
	readonly #guildMemberAddCollector: Collector<"guildMemberAdd">;
	readonly #guildMemberRemoveCollector: Collector<"guildMemberRemove">;
	readonly #messageDeleteCollector: Collector<"messageDelete">;
	readonly #messageUpdateCollector: Collector<"messageUpdate">;

	constructor(client: Client) {
		this.log = Logger.create({ identifier: "JournallingStore", isDebug: client.environment.isDebug });

		this.#client = client;
		this.#guildBanAddCollector = new Collector();
		this.#guildBanRemoveCollector = new Collector();
		this.#guildMemberAddCollector = new Collector();
		this.#guildMemberRemoveCollector = new Collector();
		this.#messageDeleteCollector = new Collector();
		this.#messageUpdateCollector = new Collector();
	}

	async setup(): Promise<void> {
		this.log.info("Setting up journalling store...");

		this.#guildBanAddCollector.onCollect(this.#guildBanAdd.bind(this));
		this.#guildBanRemoveCollector.onCollect(this.#guildBanRemove.bind(this));
		this.#guildMemberAddCollector.onCollect(this.#guildMemberAdd.bind(this));
		this.#guildMemberRemoveCollector.onCollect(this.#guildMemberRemove.bind(this));
		this.#messageDeleteCollector.onCollect(this.#messageDelete.bind(this));
		this.#messageUpdateCollector.onCollect(this.#messageUpdate.bind(this));

		await this.#client.registerCollector("guildBanAdd", this.#guildBanAddCollector);
		await this.#client.registerCollector("guildBanRemove", this.#guildBanRemoveCollector);
		await this.#client.registerCollector("guildMemberAdd", this.#guildMemberAddCollector);
		await this.#client.registerCollector("guildMemberRemove", this.#guildMemberRemoveCollector);
		await this.#client.registerCollector("messageDelete", this.#messageDeleteCollector);
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
		this.#messageUpdateCollector.close();

		this.log.info("Journalling store torn down.");
	}

	async tryLog<Event extends keyof Events>(
		event: Event,
		{ guildId, journalling, args }: { guildId: bigint; journalling?: boolean | undefined; args: Events[Event] },
	): Promise<void> {
		// If explicitly defined as false, do not log.
		if (journalling === false) {
			this.#client.log.info(
				`Event '${event}' happened on ${this.#client.diagnostics.guild(
					guildId,
				)}, but journalling for that feature is explicitly turned off. Ignoring...`,
			);
			return;
		}

		const guildDocument = this.#client.documents.guilds.get(guildId.toString());
		if (guildDocument === undefined) {
			return;
		}

		const configuration = guildDocument.journalling;
		if (configuration === undefined) {
			return;
		}

		const channelId = BigInt(configuration.channelId);
		if (channelId === undefined) {
			return;
		}

		const generateMessage = loggers[event as keyof typeof loggers];
		if (generateMessage === undefined) {
			return;
		}

		const guildLocale = getLocalisationLocaleByLanguage(guildDocument.localisationLanguage);
		const message = await generateMessage(
			this.#client,
			// @ts-ignore: This is fine.
			args,
			{
				guildLocale,
				featureLanguage: guildDocument.featureLanguage,
			},
		);
		if (message === undefined) {
			return;
		}

		await this.#client.bot.helpers
			.sendMessage(channelId, message)
			.catch((reason) =>
				this.log.warn(`Failed to log '${event}' event on ${this.#client.diagnostics.guild(guildId)}:`, reason),
			);
	}

	static generateMessageLog(client: Client, { messages }: { messages: Logos.Message[] }): string {
		return messages.map((message) => JournallingStore.#messageLogEntry(client, message)).join("\n\n");
	}

	static #messageLogEntry(client: Client, message: Logos.Message): string {
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

		await this.tryLog("messageDelete", { guildId, args: [payload, message] });
	}

	async #messageUpdate(message: Discord.Message): Promise<void> {
		const guildId = message.guildId;
		if (guildId === undefined) {
			return;
		}

		await this.tryLog("messageUpdate", { guildId, args: [message] });
	}

	async #getKickInformation({
		user,
		guildId,
	}: { user: Logos.User; guildId: bigint }): Promise<Discord.CamelizedDiscordAuditLogEntry | undefined> {
		const now = Date.now();

		const auditLog = await this.#client.bot.helpers
			.getAuditLog(guildId, { actionType: Discord.AuditLogEvents.MemberKick })
			.catch((reason) => {
				this.log.warn(`Could not get audit log for ${this.#client.diagnostics.guild(guildId)}:`, reason);
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
