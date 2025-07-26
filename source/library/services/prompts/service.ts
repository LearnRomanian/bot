import type { Client } from "rost/client";
import { Collector, InteractionCollector } from "rost/collectors";
import type { FeatureManagement } from "rost/models/documents/guild";
import type { Guild } from "rost/models/guild";
import type { Model } from "rost/models/model";
import type { User } from "rost/models/user";
import { LocalService } from "rost/services/service";

interface Configurations {
	verification: Guild["features"]["verification"];
	reports: Guild["features"]["reports"];
	resources: Guild["features"]["resourceSubmissions"];
	suggestions: Guild["features"]["suggestions"];
	tickets: Guild["features"]["tickets"];
}

type ConfigurationLocators = {
	[K in keyof Configurations]: (guildDocument: Guild) => Configurations[K] | undefined;
};

type PromptType = keyof Configurations;
type CustomIDs = Record<PromptType, string>;
type PromptDeleteMode = "delete" | "close" | "none";
interface ExistingPrompts {
	readonly valid: [partialId: string, prompt: Discord.Message][];
	readonly invalid: Discord.Message[];
	readonly noPromptsMessage: Discord.Message | undefined;
}

abstract class PromptService<
	Generic extends {
		type: PromptType;
		model: Model;
		metadata: [partialId: string, ...data: string[]];
	} = {
		type: PromptType;
		model: Model;
		metadata: [partialId: string, isResolve: string];
	},
> extends LocalService {
	static readonly #configurationLocators = Object.freeze({
		verification: (guildDocument) => guildDocument.feature("verification"),
		reports: (guildDocument) => guildDocument.feature("reports"),
		resources: (guildDocument) => guildDocument.feature("resourceSubmissions"),
		suggestions: (guildDocument) => guildDocument.feature("suggestions"),
		tickets: (guildDocument) => guildDocument.feature("tickets"),
	} as const satisfies ConfigurationLocators);
	static readonly #customIds = Object.freeze({
		verification: constants.components.verification,
		reports: constants.components.reports,
		resources: constants.components.resources,
		suggestions: constants.components.suggestions,
		tickets: constants.components.tickets,
	} as const satisfies CustomIDs);

	readonly documents: Map<string, Generic["model"]>;
	readonly promptByPartialId: Map</*partialId: */ string, Discord.Message>;
	readonly magicButton: InteractionCollector<Generic["metadata"]>;
	readonly removeButton: InteractionCollector<[partialId: string]>;
	#noPromptsMessage: Discord.Message | undefined;

	readonly #type: Generic["type"];
	readonly #deleteMode: PromptDeleteMode;
	readonly #handlerByPartialId: Map<
		/*partialId: */ string,
		(interaction: Rost.Interaction<Generic["metadata"]>) => void
	>;
	readonly #documentByPromptId: Map</*promptId: */ bigint, Generic["model"]>;
	readonly #userIdByPromptId: Map</*promptId: */ bigint, bigint>;
	readonly #configuration: ConfigurationLocators[Generic["type"]];
	readonly #messageUpdates: Collector<"messageUpdate">;
	readonly #messageDeletes: Collector<"messageDelete">;

	get configuration(): NonNullable<Configurations[Generic["type"]]> {
		return this.#configuration(this.guildDocument)!;
	}

	get channelId(): bigint {
		return BigInt(this.configuration.channelId);
	}

	constructor(
		client: Client,
		{ identifier, guildId }: { identifier: string; guildId: bigint },
		{ type, deleteMode }: { type: Generic["type"]; deleteMode: PromptDeleteMode },
	) {
		super(client, { identifier, guildId });

		const customId = PromptService.#customIds[type];
		this.magicButton = new InteractionCollector(client, { customId, isPermanent: true });
		this.removeButton = new InteractionCollector(client, {
			guildId,
			customId: InteractionCollector.encodeCustomId([constants.components.removePrompt, customId]),
			isPermanent: true,
		});

		this.documents = new Map();
		this.promptByPartialId = new Map();

		this.#type = type;
		this.#deleteMode = deleteMode;
		this.#handlerByPartialId = new Map();
		this.#documentByPromptId = new Map();
		this.#userIdByPromptId = new Map();
		this.#configuration = PromptService.#configurationLocators[type];
		this.#messageUpdates = new Collector<"messageUpdate">({ guildId });
		this.#messageDeletes = new Collector<"messageDelete">({ guildId });
	}

	static encodeMetadataInUserAvatar({ user, partialId }: { user: Rost.User; partialId: string }): string {
		const iconUrl = Discord.avatarUrl(user.id, user.discriminator, {
			avatar: user.avatar,
			size: 64,
			format: "png",
		});

		return `${iconUrl}&metadata=${partialId}`;
	}

	static encodeMetadataInGuildIcon({ guild, partialId }: { guild: Rost.Guild; partialId: string }): string {
		const iconUrl = Discord.guildIconUrl(guild.id, guild.icon);

		return `${iconUrl}&metadata=${partialId}`;
	}

	async start(): Promise<void> {
		this.#restoreDocuments();

		const existingPrompts = await this.#getExistingPrompts();

		if (existingPrompts.noPromptsMessage !== undefined) {
			this.#registerNoPromptsMessage(existingPrompts.noPromptsMessage);
		}

		const expiredPrompts = await this.#restoreStateForValidPrompts(existingPrompts.valid);
		await this.#deleteInvalidPrompts([...existingPrompts.invalid, ...expiredPrompts.values()]);

		if (existingPrompts.noPromptsMessage === undefined) {
			await this.#tryPostNoPromptsMessage();
		}

		this.#messageUpdates.onCollect(this.#handleMessageUpdate.bind(this));
		this.#messageDeletes.onCollect(this.#handleMessageDelete.bind(this));
		this.magicButton.onInteraction(this.#handleMagicButtonPress.bind(this));
		this.removeButton.onInteraction(this.#handlePromptRemove.bind(this));

		await this.client.registerCollector("messageUpdate", this.#messageUpdates);
		await this.client.registerCollector("messageDelete", this.#messageDeletes);
		await this.client.registerInteractionCollector(this.magicButton);
		await this.client.registerInteractionCollector(this.removeButton);
	}

	async stop(): Promise<void> {
		await this.#messageUpdates.close();
		await this.#messageDeletes.close();
		await this.magicButton.close();
		await this.removeButton.close();

		this.documents.clear();
		this.promptByPartialId.clear();

		this.#handlerByPartialId.clear();
		this.#documentByPromptId.clear();
		this.#userIdByPromptId.clear();
	}

	#restoreDocuments(): void {
		const documents = this.getAllDocuments();

		this.log.info(
			`Found ${documents.size} ${this.#type} documents on ${this.client.diagnostics.guild(this.guild)}.`,
		);

		for (const [partialId, document] of documents.entries()) {
			this.documents.set(partialId, document);
		}
	}

	async #getExistingPrompts(): Promise<ExistingPrompts> {
		const messages = (await this.getAllMessages({ channelId: this.channelId })) ?? [];

		const valid: [partialId: string, prompt: Discord.Message][] = [];
		const invalid: Discord.Message[] = [];
		let noPromptsMessage: Discord.Message | undefined;

		for (const message of messages) {
			const metadata = this.getMetadata(message);
			if (metadata === undefined) {
				invalid.push(message);
				continue;
			}

			if (metadata === constants.components.noPrompts) {
				if (noPromptsMessage !== undefined) {
					invalid.push(message);
					continue;
				}

				noPromptsMessage = message;
				continue;
			}

			valid.push([metadata, message]);
		}

		this.log.info(`Found ${messages.length} messages in ${this.client.diagnostics.channel(this.channelId)}.`);

		if (invalid.length > 0) {
			this.log.warn(
				`${invalid.length} messages in ${this.client.diagnostics.channel(this.channelId)} aren't prompts or are invalid.`,
			);
		}

		return { valid, invalid, noPromptsMessage };
	}

	async #restoreStateForValidPrompts(
		prompts: [partialId: string, prompt: Discord.Message][],
	): Promise<Map<string, Discord.Message>> {
		if (prompts.length > 0) {
			this.log.info(`Restoring state for ${prompts.length} ${this.#type} documents...`);
		}

		const remainingPrompts = new Map(prompts);
		for (const [_, document] of this.documents) {
			const userDocument = await this.getUserDocument(document);
			const userId = BigInt(userDocument.userId);

			let prompt = remainingPrompts.get(document.partialId);
			if (prompt !== undefined) {
				remainingPrompts.delete(document.partialId);
			} else {
				this.log.warn(
					`Could not find existing prompt for ${document.id}. Has it been manually deleted? Recreating...`,
				);

				const user = this.client.entities.users.get(userId);
				if (user === undefined) {
					this.log.warn(`Could not find the author object for ${document.id}. Invalidating submission...`);

					await document.delete(this.client);

					continue;
				}

				const message = await this.savePrompt(user, document);
				if (message === undefined) {
					this.log.info(`Could not create prompt for ${document.id}. Skipping...`);

					continue;
				}

				prompt = message;
			}

			this.registerPrompt(prompt, userId, document);
			this.registerDocument(document);
			this.registerHandler(document);
		}

		if (remainingPrompts.size > 0) {
			this.log.warn(`Could not restore the prompt-to-document link between ${remainingPrompts.size} prompts.`);
		}

		return remainingPrompts;
	}

	async #deleteInvalidPrompts(prompts: Discord.Message[]): Promise<void> {
		if (prompts.length === 0) {
			return;
		}

		this.log.warn(`Deleting ${prompts.length} invalid or expired prompts...`);

		for (const prompt of prompts) {
			await this.client.bot.helpers
				.deleteMessage(prompt.channelId, prompt.id)
				.catch((error) => this.log.warn(error, "Failed to delete invalid or expired prompt."));
		}
	}

	// Anti-tampering feature; detects prompts being changed from the outside (embeds being deleted).
	async #handleMessageUpdate(message: Discord.Message): Promise<void> {
		// If the message was updated in a channel not managed by this prompt manager.
		if (message.channelId !== this.channelId) {
			return;
		}

		// If the embed is still present, it wasn't an embed having been deleted. Do not do anything.
		if (message.embeds?.length === 1) {
			return;
		}

		// Delete the message and allow the bot to handle the deletion.
		this.client.bot.helpers
			.deleteMessage(message.channelId, message.id)
			.catch((error) =>
				this.log.warn(
					error,
					`Failed to delete prompt ${this.client.diagnostics.message(
						message,
					)} from ${this.client.diagnostics.channel(message.channelId)} on ${this.client.diagnostics.guild(
						message.guildId ?? 0n,
					)}.`,
				),
			);
	}

	// Anti-tampering feature; detects prompts being deleted.
	async #handleMessageDelete({ id, channelId }: { id: bigint; channelId: bigint }): Promise<void> {
		// If the message was deleted from a channel not managed by this prompt manager.
		if (channelId !== this.channelId) {
			return;
		}

		if (this.#noPromptsMessage !== undefined && id === this.#noPromptsMessage.id) {
			this.#unregisterNoPromptsMessage();
			await this.#tryPostNoPromptsMessage();
			return;
		}

		const promptDocument = this.#documentByPromptId.get(id);
		if (promptDocument === undefined) {
			await this.#tryPostNoPromptsMessage();
			return;
		}

		const userId = this.#userIdByPromptId.get(id);
		if (userId === undefined) {
			return;
		}

		const user = this.client.entities.users.get(userId);
		if (user === undefined) {
			return;
		}

		const prompt = await this.savePrompt(user, promptDocument);
		if (prompt === undefined) {
			return;
		}

		const partialId = this.getMetadata(prompt);
		if (partialId === undefined) {
			return;
		}

		this.registerPrompt(prompt, userId, promptDocument);

		this.#documentByPromptId.delete(id);
		this.#userIdByPromptId.delete(id);

		await this.#tryPostNoPromptsMessage();
	}

	#handleMagicButtonPress(buttonPress: Rost.Interaction<Generic["metadata"], any>): void {
		const handle = this.#handlerByPartialId.get(buttonPress.metadata[1]);
		if (handle === undefined) {
			return;
		}

		handle(buttonPress);
	}

	async #handlePromptRemove(buttonPress: Rost.Interaction): Promise<void> {
		const customId = buttonPress.data?.customId;
		if (customId === undefined) {
			return;
		}

		const guildId = buttonPress.guildId;
		if (guildId === undefined) {
			return;
		}

		const member = buttonPress.member;
		if (member === undefined) {
			return;
		}

		let management: FeatureManagement | undefined;
		switch (this.#type) {
			case "verification": {
				management = this.guildDocument.managers("verification");
				break;
			}
			case "reports": {
				management = this.guildDocument.managers("reports");
				break;
			}
			case "suggestions": {
				management = this.guildDocument.managers("suggestions");
				break;
			}
			case "resources": {
				management = this.guildDocument.managers("resourceSubmissions");
				break;
			}
			case "tickets": {
				management = this.guildDocument.managers("tickets");
				break;
			}
			default: {
				management = undefined;
				break;
			}
		}

		const isAuthorised =
			member.roles.some((roleId) => management?.roles?.includes(roleId.toString()) ?? false) ||
			(management?.users?.includes(buttonPress.user.id.toString()) ?? false);
		if (!isAuthorised) {
			if (this.#deleteMode === "delete") {
				const strings = constants.contexts.cannotRemovePrompt({
					localise: this.client.localise,
					locale: buttonPress.locale,
				});
				this.client.warning(buttonPress, { title: strings.title, description: strings.description }).ignore();

				return;
			}

			if (this.#deleteMode === "close") {
				const strings = constants.contexts.cannotCloseIssue({
					localise: this.client.localise,
					locale: buttonPress.locale,
				});
				this.client.warning(buttonPress, { title: strings.title, description: strings.description }).ignore();

				return;
			}

			return;
		}

		this.client.acknowledge(buttonPress).ignore();

		const prompt = this.promptByPartialId.get(buttonPress.metadata[1]);
		if (prompt === undefined) {
			return;
		}

		const promptDocument = this.#documentByPromptId.get(prompt.id);
		if (promptDocument === undefined) {
			return;
		}

		await this.handleDelete(promptDocument);
	}

	abstract getAllDocuments(): Map<string, Generic["model"]>;
	abstract getUserDocument(promptDocument: Generic["model"]): Promise<User>;
	abstract getPromptContent(
		user: Rost.User,
		promptDocument: Generic["model"],
	): Discord.CreateMessageOptions | undefined;
	abstract getNoPromptsMessageContent(): Discord.CreateMessageOptions;

	async #tryPostNoPromptsMessage(): Promise<Discord.Message | undefined> {
		if (this.#documentByPromptId.size > 0) {
			return;
		}

		const message = await this.client.bot.helpers
			.sendMessage(this.channelId, this.getNoPromptsMessageContent())
			.catch((error) => {
				this.log.warn(error, `Failed to send message to ${this.client.diagnostics.channel(this.channelId)}.`);
				return undefined;
			});
		if (message === undefined) {
			return undefined;
		}

		this.#registerNoPromptsMessage(message);

		return message;
	}

	async #tryDeleteNoPromptsMessage(): Promise<void> {
		if (this.#documentByPromptId.size === 0 || this.#noPromptsMessage === undefined) {
			return;
		}

		await this.client.bot.helpers
			.deleteMessage(this.#noPromptsMessage.channelId, this.#noPromptsMessage.id)
			.catch((error) => this.log.warn(error, "Failed to delete no prompts message."));
	}

	getMetadata(prompt: Discord.Message): string | undefined {
		return prompt.embeds?.at(-1)?.footer?.iconUrl?.split("&metadata=").at(-1);
	}

	async savePrompt(user: Rost.User, promptDocument: Generic["model"]): Promise<Discord.Message | undefined> {
		const content = this.getPromptContent(user, promptDocument);
		if (content === undefined) {
			return undefined;
		}

		const prompt = await this.client.bot.helpers.sendMessage(this.channelId, content).catch((error) => {
			this.log.warn(error, `Failed to send message to ${this.client.diagnostics.channel(this.channelId)}.`);
			return undefined;
		});
		if (prompt === undefined) {
			return undefined;
		}

		this.registerDocument(promptDocument);
		this.registerPrompt(prompt, user.id, promptDocument);
		this.registerHandler(promptDocument);

		await this.#tryDeleteNoPromptsMessage();

		return prompt;
	}

	#registerNoPromptsMessage(message: Discord.Message): void {
		this.#noPromptsMessage = message;
	}

	#unregisterNoPromptsMessage(): void {
		this.#noPromptsMessage = undefined;
	}

	registerDocument(promptDocument: Generic["model"]): void {
		this.documents.set(promptDocument.partialId, promptDocument);
	}

	unregisterDocument(promptDocument: Generic["model"]): void {
		this.documents.delete(promptDocument.partialId);
	}

	registerPrompt(prompt: Discord.Message, userId: bigint, promptDocument: Generic["model"]): void {
		this.promptByPartialId.set(promptDocument.partialId, prompt);

		this.#documentByPromptId.set(prompt.id, promptDocument);
		this.#userIdByPromptId.set(prompt.id, userId);
	}

	unregisterPrompt(prompt: Discord.Message, promptDocument: Generic["model"]): void {
		this.promptByPartialId.delete(promptDocument.partialId);

		this.#documentByPromptId.delete(prompt.id);
		this.#userIdByPromptId.delete(prompt.id);
	}

	registerHandler(promptDocument: Generic["model"]): void {
		this.#handlerByPartialId.set(promptDocument.partialId, async (interaction) => {
			const updatedDocument = await this.handlePromptInteraction(interaction);
			if (updatedDocument === undefined) {
				return;
			}

			const prompt = this.promptByPartialId.get(interaction.metadata[1]);
			if (prompt === undefined) {
				return;
			}

			if (updatedDocument === null) {
				this.unregisterDocument(promptDocument);
				this.unregisterPrompt(prompt, promptDocument);
				this.unregisterHandler(promptDocument);
			} else {
				this.#documentByPromptId.set(prompt.id, updatedDocument);
			}

			await this.client.bot.helpers
				.deleteMessage(prompt.channelId, prompt.id)
				.catch((error) => this.log.warn(error, "Failed to delete prompt."));
		});
	}

	unregisterHandler(promptDocument: Generic["model"]): void {
		this.#handlerByPartialId.delete(promptDocument.partialId);
	}

	abstract handlePromptInteraction(
		interaction: Rost.Interaction<Generic["metadata"]>,
	): Promise<Generic["model"] | undefined | null>;

	async handleDelete(promptDocument: Generic["model"]): Promise<void> {
		await promptDocument.delete(this.client);

		const prompt = this.promptByPartialId.get(promptDocument.partialId);
		if (prompt !== undefined) {
			this.client.bot.helpers
				.deleteMessage(prompt.channelId, prompt.id)
				.catch((error) => this.log.warn(error, "Failed to delete prompt after deleting document."));
			this.unregisterPrompt(prompt, promptDocument);
		}

		this.unregisterDocument(promptDocument);
		this.unregisterHandler(promptDocument);
	}
}

export { PromptService };
