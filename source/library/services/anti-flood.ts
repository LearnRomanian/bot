import defaults from "rost:constants/defaults";
import { mention } from "rost:constants/formatting";
import { type TimeStruct, timeStructToMilliseconds } from "rost:constants/time";
import { isDefined } from "rost:core/utilities";
import type { Client } from "rost/client";
import { Collector } from "rost/collectors";
import type { Guild } from "rost/models/guild";
import { LocalService } from "rost/services/service";

interface CandidateFloodMessage {
	readonly id: bigint;
	readonly channelId: bigint;
	readonly content?: string;
	readonly attachments?: Discord.Attachment[];
}

type FloodBuffer = Map</* messageId: */ bigint, CandidateFloodMessage>;

class AntiFloodService extends LocalService {
	readonly #messageCreates: Collector<"messageCreate">;
	readonly #floodBuffers: Map</* guildId: */ bigint, Map</* userId: */ bigint, FloodBuffer>>;

	get configuration(): NonNullable<Guild["features"]["antiFlood"]> {
		return this.guildDocument.feature("antiFlood");
	}

	constructor(client: Client, { guildId }: { guildId: bigint }) {
		super(client, { identifier: "AntiFloodService", guildId });

		this.#messageCreates = new Collector({ guildId });
		this.#floodBuffers = new Map();
	}

	async start(): Promise<void> {
		this.#messageCreates.onCollect(this.#handleMessageCreate.bind(this));

		await this.client.registerCollector("messageCreate", this.#messageCreates);
	}

	async stop(): Promise<void> {
		await this.#messageCreates.close();
	}

	async #handleMessageCreate(message: Rost.Message): Promise<void> {
		if (message.author.bot) {
			return;
		}

		if (message.guildId === undefined) {
			return;
		}

		const member = this.client.entities.members.get(message.guildId)?.get(message.author.id);
		if (member === undefined) {
			return;
		}

		const roles = member.roles.map((roleId) => this.client.entities.roles.get(roleId)).filter(isDefined);
		if (roles.some((role) => role.permissions.has("MODERATE_MEMBERS"))) {
			return;
		}

		if (!this.#floodBuffers.has(message.guildId)) {
			this.#floodBuffers.set(message.guildId, new Map());
		}

		const floodBuffersForGuild = this.#floodBuffers.get(message.guildId)!;
		if (!floodBuffersForGuild.has(message.author.id)) {
			floodBuffersForGuild.set(message.author.id, new Map());
		}

		this.#removeExpiredMessages({ guildId: message.guildId, userId: message.author.id });
		this.#registerMessage(message);
		await this.#investigateBuffer({ guildId: message.guildId, userId: message.author.id });
	}

	#removeExpiredMessages({ guildId, userId }: { guildId: bigint; userId: bigint }): void {
		const buffer = this.#floodBuffers.get(guildId)!.get(userId)!;

		const intervalBoundary =
			Date.now() - timeStructToMilliseconds(this.configuration.interval ?? defaults.FLOOD_INTERVAL);
		const inactiveMessageIds = Array.from(buffer.keys()).filter(
			(createdAt) => Discord.snowflakeToTimestamp(createdAt) < intervalBoundary,
		);
		for (const inactiveMessageId of inactiveMessageIds) {
			buffer.delete(inactiveMessageId);
		}
	}

	#registerMessage(message: Rost.Message): void {
		const buffer = this.#floodBuffers.get(message.guildId!)!.get(message.author.id)!;

		const messageCandidate: CandidateFloodMessage = {
			id: message.id,
			channelId: message.channelId,
			content: message.content,
			attachments: message.attachments,
		};

		buffer.set(message.id, messageCandidate);
	}

	async #investigateBuffer({ guildId, userId }: { guildId: bigint; userId: bigint }): Promise<void> {
		const buffer = this.#floodBuffers.get(guildId)!.get(userId)!;
		const messages = Array.from(buffer.values());

		const duplicates = this.#findDuplicateMessages(messages);
		if (duplicates.length < (this.configuration.messageCount ?? defaults.FLOOD_MESSAGE_COUNT)) {
			return;
		}

		await this.#handleFlooding({ guildId, userId, messagesToDelete: duplicates });
	}

	async #handleFlooding({
		guildId,
		userId,
		messagesToDelete,
	}: { guildId: bigint; userId: bigint; messagesToDelete: CandidateFloodMessage[] }) {
		const buffer = this.#floodBuffers.get(guildId)!.get(userId)!;
		for (const message of messagesToDelete) {
			buffer.delete(message.id);

			this.client.bot.helpers
				.deleteMessage(message.channelId, message.id)
				.catch((error) =>
					this.client.log.warn(error, `Failed to delete ${this.client.diagnostics.message(message.id)}`),
				)
				.ignore();
		}

		const timeout = this.configuration.timeoutDuration ?? defaults.FLOOD_TIMEOUT;

		if (this.guildDocument.hasEnabled("alerts")) {
			this.#sendAlert({ userId, timeout }).ignore();
		}

		await this.#timeUserOut({ userId, timeoutDuration: timeStructToMilliseconds(timeout) });
	}

	#findDuplicateMessages(messages: CandidateFloodMessage[]): CandidateFloodMessage[] {
		const results = new Set<CandidateFloodMessage>();
		function addDuplicates(a: CandidateFloodMessage, b: CandidateFloodMessage) {
			results.add(a);
			results.add(b);
		}

		for (const [messageOne, messageTwo] of messages.flatMap((a, index) =>
			messages.slice(index + 1).map((b) => [a, b] as const),
		)) {
			if (
				messageOne.content !== undefined &&
				messageTwo.content !== undefined &&
				messageOne.content === messageTwo.content
			) {
				addDuplicates(messageOne, messageTwo);
				continue;
			}

			const attachmentsOne = messageOne.attachments;
			const attachmentsTwo = messageTwo.attachments;
			if (attachmentsOne === undefined || attachmentsTwo === undefined) {
				continue;
			}

			for (const [attachmentOne, attachmentTwo] of attachmentsOne.flatMap((a) =>
				attachmentsTwo.map((b) => [a, b] as const),
			)) {
				if (
					attachmentOne.contentType === attachmentTwo.contentType &&
					attachmentOne.size === attachmentTwo.size
				) {
					addDuplicates(messageOne, messageTwo);
				}
			}
		}

		return Array.from(results.values());
	}

	async #sendAlert({ userId, timeout }: { userId: bigint; timeout: TimeStruct }): Promise<void> {
		const alertService = this.client.services.local("alerts", { guildId: this.guildId });
		if (alertService === undefined) {
			return;
		}

		const interval = this.configuration.interval ?? defaults.FLOOD_INTERVAL;

		const strings = constants.contexts.floodDetectedAndTimedOut({
			localise: this.client.localise,
			locale: this.guildLocale,
		});
		await alertService.alert({
			embeds: [
				{
					title: strings.title,
					description: strings.description({
						user_mention: mention(userId, { type: "user" }),
						messages: this.client.pluralise(
							"antiFlood.floodDetectedAndTimedOut.description.messages",
							this.guildLocale,
							{ quantity: this.configuration.messageCount ?? defaults.FLOOD_MESSAGE_COUNT },
						),
						interval: this.client.pluralise(`units.${interval[1]}.word`, this.guildLocale, {
							quantity: interval[0],
						}),
						duration: this.client.pluralise(`units.${timeout[1]}.word`, this.guildLocale, {
							quantity: timeout[0],
						}),
					}),
					color: constants.colours.red,
				},
			],
		});
	}

	async #timeUserOut({ userId, timeoutDuration }: { userId: bigint; timeoutDuration: number }): Promise<void> {
		await this.client.bot.helpers
			.editMember(this.guildId, userId, {
				communicationDisabledUntil: new Date(Date.now() + timeoutDuration).toISOString(),
			})
			.catch((error) =>
				this.client.log.warn(error, `Failed to edit timeout state of ${this.client.diagnostics.user(userId)}.`),
			);
	}
}

export { AntiFloodService };
