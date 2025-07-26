import { default as hashObject } from "object-hash";
import type { Client } from "rost/client";
import { Collector } from "rost/collectors";
import type { Guild } from "rost/models/guild";
import { LocalService } from "rost/services/service";

type HashableProperties = "embeds" | "components";
type HashableMessageContents = Pick<Discord.CreateMessageOptions, HashableProperties>;

interface NoticeData {
	readonly id: bigint;
	readonly hash: string;
}

interface Configurations {
	information: Guild["features"]["informationNotices"];
	resources: Guild["features"]["resourceNotices"];
	roles: Guild["features"]["roleNotices"];
	welcome: Guild["features"]["welcomeNotices"];
}

type ConfigurationLocators = {
	[K in keyof Configurations]: (guildDocument: Guild) => Configurations[K] | undefined;
};

type NoticeTypes = keyof Configurations;

abstract class NoticeService<Generic extends { type: NoticeTypes }> extends LocalService {
	static readonly #configurationLocators = Object.freeze({
		information: (guildDocument) => guildDocument.feature("informationNotices"),
		resources: (guildDocument) => guildDocument.feature("resourceNotices"),
		roles: (guildDocument) => guildDocument.feature("roleNotices"),
		welcome: (guildDocument) => guildDocument.feature("welcomeNotices"),
	} as const satisfies ConfigurationLocators);

	readonly #configuration: ConfigurationLocators[Generic["type"]];
	readonly #messageUpdates: Collector<"messageUpdate">;
	readonly #messageDeletes: Collector<"messageDelete">;
	#noticeData: NoticeData | undefined;

	get configuration(): NonNullable<Configurations[Generic["type"]]> {
		return this.#configuration(this.guildDocument)!;
	}

	get channelId(): bigint | undefined {
		return this.configuration.channelId !== undefined ? BigInt(this.configuration.channelId) : undefined;
	}

	constructor(
		client: Client,
		{ identifier, guildId }: { identifier: string; guildId: bigint },
		{ type }: { type: Generic["type"] },
	) {
		super(client, { identifier, guildId });

		this.#configuration = NoticeService.#configurationLocators[type];
		this.#messageUpdates = new Collector<"messageUpdate">({ guildId });
		this.#messageDeletes = new Collector<"messageDelete">({ guildId });
	}

	static #hashMessageContents(contents: HashableMessageContents): string {
		return hashObject(contents, {
			algorithm: "md5",
			unorderedArrays: true,
			unorderedObjects: true,
			unorderedSets: true,
		});
	}

	static encodeHashInGuildIcon({ guild, hash }: { guild: Rost.Guild; hash: string }): string {
		const iconUrl = Discord.guildIconUrl(guild.id, guild.icon);

		return `${iconUrl}&hash=${hash}`;
	}

	abstract generateNotice(): HashableMessageContents | undefined;

	async start(): Promise<void> {
		this.#messageUpdates.onCollect(this.#handleMessageUpdate.bind(this));
		this.#messageDeletes.onCollect((payload) => {
			const message = this.client.entities.messages.latest.get(payload.id);
			if (message === undefined) {
				return;
			}

			this.#handleMessageDelete(message);
		});

		await this.client.registerCollector("messageUpdate", this.#messageUpdates);
		await this.client.registerCollector("messageDelete", this.#messageDeletes);

		const channelId = this.channelId;
		if (channelId === undefined) {
			return;
		}

		const expectedContents = this.generateNotice();
		if (expectedContents === undefined) {
			return;
		}

		const expectedHash = NoticeService.#hashMessageContents(expectedContents);

		const noticesAll = await this.getAllMessages({ channelId });
		if (noticesAll === undefined || noticesAll.length === 0) {
			const notice = await this.#sendNotice({ contents: expectedContents, hash: expectedHash });
			if (notice === undefined) {
				return;
			}

			this.#registerNotice({ noticeId: notice.id, hash: expectedHash });
			return;
		}

		if (noticesAll.length > 1) {
			while (noticesAll.length > 0) {
				const notice = noticesAll.pop();
				if (notice === undefined) {
					return;
				}

				await this.client.bot.helpers
					.deleteMessage(channelId, notice.id)
					.catch((error) => this.log.warn(error, "Failed to delete notice."));
			}
		}

		if (noticesAll.length === 1) {
			const notice = noticesAll.pop();
			if (notice === undefined) {
				return;
			}

			const { embeds, components }: HashableMessageContents = notice as unknown as HashableMessageContents;
			const contents: HashableMessageContents = { embeds, components };

			const hash = contents.embeds?.at(-1)?.footer?.iconUrl?.split("&hash=").at(-1);
			if (hash === undefined || hash !== expectedHash) {
				await this.client.bot.helpers
					.deleteMessage(channelId, notice.id)
					.catch((error) => this.log.warn(error, "Failed to delete notice."));

				const newNotice = await this.#sendNotice({ contents: expectedContents, hash: expectedHash });
				if (newNotice === undefined) {
					return;
				}

				this.#registerNotice({ noticeId: newNotice.id, hash: expectedHash });
				return;
			}

			this.#registerNotice({ noticeId: notice.id, hash });
		}
	}

	async stop(): Promise<void> {
		await this.#messageUpdates.close();
		await this.#messageDeletes.close();

		this.#noticeData = undefined;
	}

	// Anti-tampering feature; detects notices being changed from the outside (embeds being deleted).
	async #handleMessageUpdate(message: Discord.Message): Promise<void> {
		// If the message was updated in a channel not managed by this notice manager.
		if (message.channelId !== this.channelId) {
			return;
		}

		// If the embed is still present, it wasn't an embed having been deleted. Do not do anything.
		if ((message.embeds?.length ?? 0) > 0) {
			return;
		}

		// Delete the message and allow the bot to handle the deletion.
		this.client.bot.helpers
			.deleteMessage(message.channelId, message.id)
			.catch((error) =>
				this.log.warn(
					error,
					`Failed to delete notice ${this.client.diagnostics.message(
						message,
					)} from ${this.client.diagnostics.channel(message.channelId)} on ${this.client.diagnostics.guild(
						message.guildId ?? 0n,
					)}.`,
				),
			);
	}

	// Anti-tampering feature; detects notices being deleted.
	async #handleMessageDelete(message: Rost.Message): Promise<void> {
		const [channelId, noticeData] = [this.channelId, this.#noticeData];
		if (channelId === undefined || noticeData === undefined) {
			return;
		}

		// If the message was deleted from a channel not managed by this prompt manager.
		if (message.channelId !== this.channelId) {
			return;
		}

		if (message.id !== noticeData.id) {
			return;
		}

		const contents = this.generateNotice();
		if (contents === undefined) {
			return;
		}

		const hash = NoticeService.#hashMessageContents(contents);

		const notice = await this.#sendNotice({ contents, hash });
		if (notice === undefined) {
			return;
		}

		this.#registerNotice({ noticeId: notice.id, hash });
	}

	async #sendNotice({
		contents,
		hash,
	}: { contents: HashableMessageContents; hash: string }): Promise<Discord.Message | undefined> {
		const [channelId, guild] = [this.channelId, this.guild];
		if (channelId === undefined || guild === undefined) {
			return undefined;
		}

		const lastEmbed = contents.embeds?.at(-1);
		if (lastEmbed === undefined) {
			return undefined;
		}

		lastEmbed.footer = { text: guild.name, iconUrl: NoticeService.encodeHashInGuildIcon({ guild, hash }) };

		return this.client.bot.helpers.sendMessage(channelId, contents).catch((error) => {
			this.log.warn(error, `Failed to send message to ${this.client.diagnostics.channel(channelId)}.`);
			return undefined;
		});
	}

	#registerNotice({ noticeId, hash }: { noticeId: bigint; hash: string }): void {
		this.#noticeData = { id: noticeId, hash };
	}
}

export { NoticeService };
export type { HashableMessageContents };
