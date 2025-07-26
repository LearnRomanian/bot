import { timestamp, trim } from "rost:constants/formatting";
import { getSnowflakeFromIdentifier } from "rost:constants/patterns";
import { nanoid } from "nanoid";
import type pino from "pino";
import type { Client } from "rost/client";
import { InteractionCollector } from "rost/collectors";
import type { Guild } from "rost/models/guild";
import { Model } from "rost/models/model";
import type { CommandStore } from "rost/stores/commands";

type InteractionCallbackData = Omit<Discord.InteractionCallbackData, "flags">;
type EmbedOrCallbackData = Discord.Camelize<Discord.DiscordEmbed> | InteractionCallbackData;
interface ReplyData {
	readonly ephemeral: boolean;
}
class InteractionStore {
	readonly log: pino.Logger;

	readonly #client: Client;
	readonly #commands: CommandStore;
	readonly #registeredInteractions: Map<bigint, Rost.Interaction>;
	readonly #replies: Map</* token: */ string, ReplyData>;
	readonly #messages: Map</* token: */ string, bigint>;

	readonly #interactions: InteractionCollector;

	/** ⬜ The action should have succeeded if not for the bot's limitations. */
	get unsupported(): InteractionStore["reply"] {
		return this.#buildColouredReplier({ colour: constants.colours.unsupported });
	}

	/** 🟦 Informational message. */
	get notice(): InteractionStore["reply"] {
		return this.#buildColouredReplier({ colour: constants.colours.notice });
	}

	/** @see {@link notice()} */
	get noticed(): InteractionStore["editReply"] {
		return this.#buildColouredReplyEditor({ colour: constants.colours.notice });
	}

	/**
	 * 🟩 The action intended to be performed with the interaction succeeded.
	 *
	 * @remarks
	 * 🟦 Shows up as a notice if the reply is public.
	 */
	get success(): InteractionStore["reply"] {
		return async (interaction, embedOrData, flags) => {
			if (flags?.visible) {
				return this.notice(interaction, embedOrData, flags);
			}

			return this.#buildColouredReplier({ colour: constants.colours.success })(interaction, embedOrData, flags);
		};
	}

	/** @see {@link success()} */
	get succeeded(): InteractionStore["editReply"] {
		return async (interaction, embedOrData) => {
			const replyData = this.#replies.get(interaction.token)!;
			if (!replyData.ephemeral) {
				return this.noticed(interaction, embedOrData);
			}

			return this.#buildColouredReplyEditor({ colour: constants.colours.success })(interaction, embedOrData);
		};
	}

	/** 🟧 The user tried to do something that isn't technically invalid, but which the bot will not allow for. */
	get pushback(): InteractionStore["reply"] {
		return this.#buildColouredReplier({ colour: constants.colours.pushback });
	}

	/** @see {@link pushback()} */
	get pushedBack(): InteractionStore["editReply"] {
		return this.#buildColouredReplyEditor({ colour: constants.colours.pushback });
	}

	/** 🟨 The user unintentionally did something wrong. */
	get warning(): InteractionStore["reply"] {
		return this.#buildColouredReplier({ colour: constants.colours.warning });
	}

	/** @see {@link warning()} */
	get warned(): InteractionStore["editReply"] {
		return this.#buildColouredReplyEditor({ colour: constants.colours.warning });
	}

	/** 🟥 The user (assumably) intentionally tried to do something wrong. */
	get error(): InteractionStore["reply"] {
		return this.#buildColouredReplier({ colour: constants.colours.error });
	}

	/** @see {@link error()} */
	get errored(): InteractionStore["editReply"] {
		return this.#buildColouredReplyEditor({ colour: constants.colours.error });
	}

	/** 🔺 The bot failed to do something that should have otherwise happened just fine. */
	get failure(): InteractionStore["reply"] {
		return this.#buildColouredReplier({ colour: constants.colours.failure });
	}

	/** @see {@link failure()} */
	get failed(): InteractionStore["editReply"] {
		return this.#buildColouredReplyEditor({ colour: constants.colours.failure });
	}

	/** ⬛ The bot had an outage or encountered a serious issue. */
	get death(): InteractionStore["reply"] {
		return this.#buildColouredReplier({ colour: constants.colours.death });
	}

	/** @see {@link death()} */
	get died(): InteractionStore["editReply"] {
		return this.#buildColouredReplyEditor({ colour: constants.colours.death });
	}

	constructor(client: Client, { commands }: { commands: CommandStore }) {
		this.log = client.log.child({ name: "InteractionStore" });

		this.#client = client;
		this.#commands = commands;
		this.#registeredInteractions = new Map();
		this.#replies = new Map();
		this.#messages = new Map();
		this.#interactions = new InteractionCollector(client, {
			anyType: true,
			anyCustomId: true,
			isPermanent: true,
		});
	}

	/**
	 * Given an interaction that was originally processed through a command handler and another
	 * interaction, for example a button press, spoofs the original interaction, replacing its token,
	 * ID and parameters.
	 */
	static spoofInteraction<Interaction extends Rost.Interaction>(
		interaction: Interaction,
		{ using, parameters }: { using: Rost.Interaction; parameters?: Interaction["parameters"] },
	): Interaction {
		return {
			...interaction,
			parameters: { ...interaction.parameters, ...parameters },
			type: Discord.InteractionTypes.ApplicationCommand,
			token: using.token,
			id: using.id,
		};
	}

	/**
	 * Given a message, constructs an interaction that can then be passed into some handler expecting
	 * to receive an interaction.
	 */
	buildMessageInteraction(
		message: Discord.Message,
		{ parameters }: { parameters?: Rost.Interaction["parameters"] },
	): Rost.Interaction | undefined {
		const guildId = message.guildId;
		if (guildId === undefined) {
			return undefined;
		}

		const guildDocument = this.#client.documents.guilds.get(
			Model.buildPartialId<Guild>({ guildId: guildId.toString() }),
		);
		if (guildDocument === undefined) {
			return undefined;
		}

		let displayLocale: Discord.Locale;
		if (guildDocument.isTargetLanguageOnlyChannel(message.channelId.toString())) {
			displayLocale = guildDocument.locales.target;
		} else {
			displayLocale = guildDocument.locales.source;
		}

		return {
			acknowledged: false,
			id: message.id,
			applicationId: this.#client.bot.applicationId,
			type: Discord.InteractionTypes.ApplicationCommand,
			guildId: guildId,
			channelId: message.channelId,
			member: message.member,
			user: message.author,
			token: nanoid(),
			data: { name: constants.components.none },
			bot: this.#client.bot as unknown as Rost.Interaction["bot"],
			locale: guildDocument.locales.source,
			guildLocale: guildDocument.locales.source,
			displayLocale,
			commandName: constants.components.none,
			metadata: [constants.components.none],
			parameters: {
				"@repeat": true,
				show: true,
				...parameters,
			},
		};
	}

	async setup(): Promise<void> {
		this.#interactions.onInteraction(this.handleInteraction.bind(this));

		await this.#client.registerInteractionCollector(this.#interactions);
	}

	async teardown(): Promise<void> {
		this.#interactions.close();
	}

	async handleInteraction(interaction: Rost.Interaction): Promise<void> {
		// If it's a "none" message interaction, just acknowledge and good to go.
		if (
			interaction.type === Discord.InteractionTypes.MessageComponent &&
			interaction.metadata[0] === constants.components.none
		) {
			this.acknowledge(interaction).ignore();

			this.log.info("Component interaction acknowledged.");

			return;
		}

		if (
			interaction.type !== Discord.InteractionTypes.ApplicationCommand &&
			interaction.type !== Discord.InteractionTypes.ApplicationCommandAutocomplete
		) {
			return;
		}

		this.log.info(`Receiving ${this.#client.diagnostics.interaction(interaction)}...`);

		const handle = this.#commands.getHandler(interaction);
		if (handle === undefined) {
			this.log.warn(
				`Could not retrieve handler for ${this.#client.diagnostics.interaction(
					interaction,
				)}. Is the command registered?`,
			);
			return;
		}

		const executedAt = Date.now();

		if (
			interaction.type !== Discord.InteractionTypes.ApplicationCommandAutocomplete &&
			this.#commands.hasRateLimit(interaction)
		) {
			const rateLimit = this.#commands.getRateLimit(interaction, { executedAt });
			if (rateLimit !== undefined) {
				const nextUsable = rateLimit.nextAllowedUsageTimestamp - executedAt;

				this.log.warn(
					`User rate-limited on ${this.#client.diagnostics.interaction(interaction)}. Next usable in ${Math.ceil(
						nextUsable / 1000,
					)} seconds.`,
				);

				const strings = constants.contexts.rateLimited({
					localise: this.#client.localise,
					locale: interaction.locale,
				});
				this.warning(interaction, {
					title: strings.title,
					description: `${strings.description.tooManyUses({
						times: constants.defaults.COMMAND_RATE_LIMIT.uses,
					})}\n\n${strings.description.cannotUseUntil({
						relative_timestamp: timestamp(rateLimit.nextAllowedUsageTimestamp, {
							format: "relative",
						}),
					})}`,
				}).ignore();

				setTimeout(() => this.deleteReply(interaction).ignore(), nextUsable);

				return;
			}
		}

		this.log.info(`Handling ${this.#client.diagnostics.interaction(interaction)}...`);

		const start = Date.now();
		await handle(this.#client, interaction)
			.then(() => {
				const end = Date.now();
				const timeTakenMilliseconds = end - start;

				this.log.info(
					`Handled ${this.#client.diagnostics.interaction(interaction)} in ${timeTakenMilliseconds}ms.`,
				);
			})
			.catch((error) =>
				this.log.error(error, `Failed to handle ${this.#client.diagnostics.interaction(interaction)}.`),
			);
	}

	registerInteraction(interaction: Rost.Interaction): void {
		this.#registeredInteractions.set(interaction.id, interaction);
	}

	unregisterInteraction(interactionId: bigint): Rost.Interaction | undefined {
		const interaction = this.#registeredInteractions.get(interactionId);
		if (interaction === undefined) {
			return undefined;
		}

		this.#registeredInteractions.delete(interactionId);

		return interaction;
	}

	#registerMessage(interaction: Rost.Interaction, { messageId }: { messageId: bigint }): void {
		setTimeout(() => this.#unregisterMessage(interaction), constants.discord.INTERACTION_TOKEN_EXPIRY);

		this.#messages.set(interaction.token, messageId);
	}

	#unregisterMessage(interaction: Rost.Interaction): void {
		// TODO(vxern): The timeout to unregister the message should be cleared immediately.

		this.#messages.delete(interaction.token);
	}

	async acknowledge(interaction: Rost.Interaction): Promise<void> {
		if (interaction.type === Discord.InteractionTypes.ApplicationCommand) {
			await this.postponeReply(interaction);
			await this.deleteReply(interaction);
			return;
		}

		await this.#client.bot.helpers
			.sendInteractionResponse(interaction.id, interaction.token, {
				type: Discord.InteractionResponseTypes.DeferredUpdateMessage,
			})
			.catch((error) => this.log.error(error, "Failed to acknowledge interaction."));
	}

	/**
	 * @remarks
	 *
	 * ⚠️ Make sure you await postponed replies, otherwise you risk introducing race conditions where the bot attempts
	 * to edit a reply before the postponing finishes.
	 */
	async postponeReply(interaction: Rost.Interaction, { visible = false } = {}): Promise<void> {
		this.#replies.set(interaction.token, { ephemeral: !visible });

		if (interaction.parameters["@repeat"]) {
			const strings = constants.contexts.thinking({
				localise: this.#client.localise,
				locale: interaction.guildLocale,
			});
			const message = await this.#client.bot.helpers
				.sendMessage(interaction.channelId, {
					messageReference: {
						messageId: interaction.id,
						channelId: interaction.channelId,
						guildId: interaction.guildId,
						failIfNotExists: false,
					},
					embeds: [
						{
							description: strings.thinking,
							color: constants.colours.notice,
						},
					],
				})
				.catch((error) => {
					this.log.error(error, "Failed to postpone message reply to repeated interaction.");
					return undefined;
				});
			if (message === undefined) {
				return;
			}

			this.#registerMessage(interaction, { messageId: message.id });
			return;
		}

		await this.#client.bot.helpers
			.sendInteractionResponse(interaction.id, interaction.token, {
				type: Discord.InteractionResponseTypes.DeferredChannelMessageWithSource,
				data: visible ? {} : { flags: Discord.MessageFlags.Ephemeral },
			})
			.catch((error) => this.log.error(error, "Failed to postpone reply to interaction."));
	}

	async reply(
		interaction: Rost.Interaction,
		embedOrData: EmbedOrCallbackData,
		{ visible = false, autoDelete = false }: { visible?: boolean; autoDelete?: boolean } = {},
	): Promise<void> {
		const data = getInteractionCallbackData(embedOrData);

		if (!visible) {
			data.flags = Discord.MessageFlags.Ephemeral;
		}

		this.#replies.set(interaction.token, { ephemeral: !visible });

		if (interaction.parameters["@repeat"]) {
			const message = await this.#client.bot.helpers
				.sendMessage(interaction.channelId, {
					messageReference: {
						messageId: interaction.id,
						channelId: interaction.channelId,
						guildId: interaction.guildId,
						failIfNotExists: false,
					},
					...data,
				})
				.catch((error) => {
					this.log.error(error, "Failed to make message reply to repeated interaction.");
					return undefined;
				});
			if (message === undefined) {
				return;
			}

			this.#registerMessage(interaction, { messageId: message.id });
			return;
		}

		await this.#client.bot.helpers
			.sendInteractionResponse(interaction.id, interaction.token, {
				type: Discord.InteractionResponseTypes.ChannelMessageWithSource,
				data,
			})
			.catch((error) => this.log.error(error, "Failed to reply to interaction."));

		if (autoDelete) {
			this.#autoDeleteReply(interaction);
		}
	}

	async editReply(
		interaction: Rost.Interaction,
		embedOrData: EmbedOrCallbackData,
		{ autoDelete = false }: { autoDelete?: boolean } = {},
	): Promise<void> {
		const data = getInteractionCallbackData(embedOrData);

		if (interaction.parameters["@repeat"]) {
			const messageId = this.#messages.get(interaction.token)!;

			await this.#client.bot.helpers.editMessage(interaction.channelId, messageId, data).catch((error) => {
				this.log.error(error, "Failed to edit message reply made to repeated interaction.");
				return undefined;
			});

			return;
		}

		await this.#client.bot.helpers
			.editOriginalInteractionResponse(interaction.token, data)
			.catch((error) => this.log.error(error, "Failed to edit reply to interaction."));

		if (autoDelete) {
			this.#autoDeleteReply(interaction);
		}
	}

	async deleteReply(interaction: Rost.Interaction): Promise<void> {
		if (interaction.parameters["@repeat"]) {
			const messageId = this.#messages.get(interaction.token)!;

			this.#messages.delete(interaction.token);

			await this.#client.bot.helpers.deleteMessage(interaction.channelId, messageId).catch((error) => {
				this.log.error(error, "Failed to delete message reply made to repeated interaction.");
				return undefined;
			});

			return;
		}

		await this.#client.bot.helpers
			.deleteOriginalInteractionResponse(interaction.token)
			.catch((error) => this.log.error(error, "Failed to delete reply to interaction."));
	}

	async respond(interaction: Rost.Interaction, choices: Discord.ApplicationCommandOptionChoice[]): Promise<void> {
		await this.#client.bot.helpers
			.sendInteractionResponse(interaction.id, interaction.token, {
				type: Discord.InteractionResponseTypes.ApplicationCommandAutocompleteResult,
				data: { choices },
			})
			.catch((error) => this.log.error(error, "Failed to respond to autocomplete interaction."));
	}

	async displayModal(
		interaction: Rost.Interaction,
		data: Omit<Discord.InteractionCallbackData, "flags">,
	): Promise<void> {
		await this.#client.bot.helpers
			.sendInteractionResponse(interaction.id, interaction.token, {
				type: Discord.InteractionResponseTypes.Modal,
				data,
			})
			.catch((error) => this.log.error(error, "Failed to show modal."));
	}

	#buildColouredReplier({ colour }: { colour: number }): InteractionStore["reply"] {
		return async (interaction, embedOrData, flags) => {
			setCallbackColour(embedOrData, { colour });

			await this.reply(interaction, embedOrData, flags);
		};
	}

	#buildColouredReplyEditor({ colour }: { colour: number }): InteractionStore["editReply"] {
		return async (interaction, embedOrData) => {
			setCallbackColour(embedOrData, { colour });

			await this.editReply(interaction, embedOrData);
		};
	}

	#autoDeleteReply(interaction: Rost.Interaction): void {
		setTimeout(() => this.#client.deleteReply(interaction).ignore(), constants.AUTO_DELETE_MESSAGE_TIMEOUT);
	}

	#resolveIdentifierToMembers({
		guildId,
		seekerUserId,
		identifier,
		options,
	}: {
		guildId: bigint;
		seekerUserId: bigint;
		identifier: string;
		options?: Partial<MemberNarrowingOptions>;
	}): [members: Rost.Member[], isResolved: boolean] | undefined {
		if (identifier.trim().length === 0) {
			return [[], false];
		}

		const seeker = this.#client.entities.members.get(guildId)?.get(seekerUserId);
		if (seeker === undefined) {
			return undefined;
		}

		const guild = this.#client.entities.guilds.get(guildId);
		if (guild === undefined) {
			return undefined;
		}

		const moderatorRoleIds = guild.roles
			.array()
			.filter((role) => role.permissions.has("MODERATE_MEMBERS"))
			.map((role) => role.id);

		const id = getSnowflakeFromIdentifier(identifier);
		if (id !== undefined) {
			const member = this.#client.entities.members.get(guildId)?.get(BigInt(id));
			if (member === undefined) {
				return undefined;
			}

			if (options?.restrictToSelf && member.id !== seeker.id) {
				return undefined;
			}

			if (options?.restrictToNonSelf && member.id === seeker.id) {
				return undefined;
			}

			if (options?.excludeModerators && moderatorRoleIds.some((roleId) => member.roles.includes(roleId))) {
				return undefined;
			}

			return [[member], true];
		}

		const cachedMembers = options?.restrictToSelf ? [seeker] : guild.members.array();
		const members = cachedMembers.filter(
			(member) =>
				(options?.restrictToNonSelf ? member.user?.id !== seeker.user?.id : true) &&
				(options?.excludeModerators ? !moderatorRoleIds.some((roleId) => member.roles.includes(roleId)) : true),
		);

		if (constants.patterns.discord.userHandle.old.test(identifier)) {
			const identifierLowercase = identifier.toLowerCase();
			const member = members.find(
				(member) =>
					member.user !== undefined &&
					`${member.user.username.toLowerCase()}#${member.user.discriminator}`.includes(identifierLowercase),
			);
			if (member === undefined) {
				return [[], false];
			}

			return [[member], true];
		}

		if (constants.patterns.discord.userHandle.new.test(identifier)) {
			const identifierLowercase = identifier.toLowerCase();
			const member = members.find((member) => member.user?.username?.toLowerCase().includes(identifierLowercase));
			if (member === undefined) {
				return [[], false];
			}

			return [[member], true];
		}

		const identifierLowercase = identifier.toLowerCase();
		const matchedMembers = members.filter((member) => {
			if (member.user?.toggles?.has("bot") && !options?.includeBots) {
				return false;
			}

			if (
				member.user &&
				`${member.user.username.toLowerCase()}#${member.user.discriminator}`.includes(identifierLowercase)
			) {
				return true;
			}

			if (member.user?.username.toLowerCase().includes(identifierLowercase)) {
				return true;
			}

			return member.nick?.toLowerCase().includes(identifierLowercase);
		});

		return [matchedMembers, false];
	}

	resolveInteractionToMember(
		interaction: Rost.Interaction,
		{
			identifier,
			options,
		}: {
			identifier: string;
			options?: Partial<MemberNarrowingOptions>;
		},
	): Rost.Member | undefined {
		const result = this.#resolveIdentifierToMembers({
			guildId: interaction.guildId,
			seekerUserId: interaction.user.id,
			identifier,
			options,
		});
		if (result === undefined) {
			return;
		}

		const [matchedMembers, isResolved] = result;
		if (isResolved) {
			return matchedMembers.at(0);
		}

		if (matchedMembers.length === 0) {
			if (
				interaction.type === Discord.InteractionTypes.ApplicationCommand ||
				interaction.type === Discord.InteractionTypes.MessageComponent ||
				interaction.type === Discord.InteractionTypes.ModalSubmit
			) {
				const strings = constants.contexts.invalidUser({
					localise: this.#client.localise,
					locale: interaction.locale,
				});
				this.error(interaction, {
					title: strings.title,
					description: strings.description,
				}).ignore();

				return undefined;
			}

			return undefined;
		}

		return matchedMembers.at(0);
	}

	async autocompleteMembers(
		interaction: Rost.Interaction,
		{
			identifier,
			options,
		}: {
			identifier: string;
			options?: Partial<MemberNarrowingOptions>;
		},
	): Promise<void> {
		const identifierTrimmed = identifier.trim();
		if (identifierTrimmed.length === 0) {
			const strings = constants.contexts.autocompleteUser({
				localise: this.#client.localise,
				locale: interaction.locale,
			});
			await this.respond(interaction, [{ name: trim(strings.autocomplete, 100), value: "" }]);
			return;
		}

		const result = this.#resolveIdentifierToMembers({
			guildId: interaction.guildId,
			seekerUserId: interaction.user.id,
			identifier: identifierTrimmed,
			options,
		});
		if (result === undefined) {
			return;
		}

		const [matchedMembers, _] = result;

		const users: Rost.User[] = [];
		for (const member of matchedMembers) {
			if (users.length === 20) {
				break;
			}

			const user = member.user;
			if (user === undefined) {
				continue;
			}

			users.push(user);
		}

		await this.respond(
			interaction,
			users.map((user) => ({
				name: this.#client.diagnostics.user(user, { prettify: true }),
				value: user.id.toString(),
			})),
		);
	}
}

interface MemberNarrowingOptions {
	readonly includeBots: boolean;
	readonly restrictToSelf: boolean;
	readonly restrictToNonSelf: boolean;
	readonly excludeModerators: boolean;
}

function isEmbed(embedOrData: EmbedOrCallbackData): embedOrData is Discord.Camelize<Discord.DiscordEmbed> {
	return "title" in embedOrData || "description" in embedOrData || "fields" in embedOrData;
}

function getInteractionCallbackData(embedOrData: EmbedOrCallbackData): Discord.InteractionCallbackData {
	if (isEmbed(embedOrData)) {
		return { embeds: [embedOrData] };
	}

	return embedOrData;
}

function setCallbackColour(embedOrData: EmbedOrCallbackData, { colour }: { colour: number }): EmbedOrCallbackData {
	if (isEmbed(embedOrData)) {
		if (embedOrData.color !== undefined) {
			return embedOrData;
		}

		embedOrData.color = colour;
	} else if (embedOrData.embeds !== undefined) {
		for (const embed of embedOrData.embeds) {
			if (embed.color !== undefined) {
				continue;
			}

			embed.color = colour;
		}
	}

	return embedOrData;
}

export { InteractionStore };
