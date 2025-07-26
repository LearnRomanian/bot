import { codeMultiline, mention, trim } from "rost:constants/formatting";
import type { Client } from "rost/client";
import type { TicketFormData, TicketType } from "rost/models/documents/ticket";
import type { EntryRequest } from "rost/models/entry-request";
import { Model } from "rost/models/model";
import { Ticket } from "rost/models/ticket";
import { User } from "rost/models/user";
import { PromptService } from "rost/services/prompts/service";

class TicketPromptService extends PromptService<{
	type: "tickets";
	model: Ticket;
	metadata: [partialId: string, isResolve: string];
}> {
	constructor(client: Client, { guildId }: { guildId: bigint }) {
		super(client, { identifier: "TicketPromptService", guildId }, { type: "tickets", deleteMode: "close" });
	}

	getAllDocuments(): Map<string, Ticket> {
		const tickets = new Map<string, Ticket>();

		for (const [partialId, ticketDocument] of this.client.documents.tickets) {
			if (ticketDocument.guildId !== this.guildIdString) {
				continue;
			}

			tickets.set(partialId, ticketDocument);
		}

		return tickets;
	}

	async getUserDocument(ticketDocument: Ticket): Promise<User> {
		return User.getOrCreate(this.client, { userId: ticketDocument.authorId });
	}

	getPromptContent(user: Rost.User, ticketDocument: Ticket): Discord.CreateMessageOptions | undefined {
		const strings = constants.contexts.promptControls({
			localise: this.client.localise,
			locale: this.guildLocale,
		});
		return {
			embeds: [
				{
					description: `*${ticketDocument.formData.topic}*`,
					color: ticketDocument.isResolved ? constants.colours.green : constants.colours.husky,
					footer: {
						text: this.client.diagnostics.user(user),
						iconUrl: PromptService.encodeMetadataInUserAvatar({
							user,
							partialId: ticketDocument.partialId,
						}),
					},
				},
			],
			components: [
				{
					type: Discord.MessageComponentTypes.ActionRow,
					components: ticketDocument.isResolved
						? [
								{
									type: Discord.MessageComponentTypes.Button,
									style: Discord.ButtonStyles.Success,
									label: strings.markUnresolved,
									customId: this.magicButton.encodeId([ticketDocument.partialId, `${false}`]),
								},
								{
									type: Discord.MessageComponentTypes.Button,
									style: Discord.ButtonStyles.Danger,
									label: strings.close,
									customId: this.removeButton.encodeId([ticketDocument.partialId]),
								},
							]
						: [
								{
									type: Discord.MessageComponentTypes.Button,
									style: Discord.ButtonStyles.Primary,
									label: strings.markResolved,
									customId: this.magicButton.encodeId([ticketDocument.partialId, `${true}`]),
								},
							],
				},
			],
		};
	}

	getNoPromptsMessageContent(): Discord.CreateMessageOptions {
		const strings = constants.contexts.noTickets({
			localise: this.client.localise,
			locale: this.guildLocale,
		});

		return {
			embeds: [
				{
					title: strings.title,
					description: strings.description,
					color: constants.colours.success,
					footer: {
						text: this.guild.name,
						iconUrl: PromptService.encodeMetadataInGuildIcon({
							guild: this.guild,
							partialId: constants.components.noPrompts,
						}),
					},
				},
			],
		};
	}

	async handlePromptInteraction(
		interaction: Rost.Interaction<[partialId: string, isResolve: string]>,
	): Promise<Ticket | null | undefined> {
		const ticketDocument = this.documents.get(interaction.metadata[1]);
		if (ticketDocument === undefined) {
			return undefined;
		}

		const isResolved = interaction.metadata[2] === "true";
		if (isResolved && ticketDocument.isResolved) {
			const strings = constants.contexts.alreadyMarkedResolved({
				localise: this.client.localise,
				locale: interaction.locale,
			});
			this.client
				.warning(interaction, {
					title: strings.title,
					description: strings.description,
				})
				.ignore();

			return;
		}

		if (!(isResolved || ticketDocument.isResolved)) {
			const strings = constants.contexts.alreadyMarkedResolved({
				localise: this.client.localise,
				locale: interaction.locale,
			});
			this.client
				.warning(interaction, {
					title: strings.title,
					description: strings.description,
				})
				.ignore();

			return;
		}

		await ticketDocument.update(this.client, () => {
			ticketDocument.isResolved = isResolved;
		});

		return ticketDocument;
	}

	async handleDelete(ticketDocument: Ticket): Promise<void> {
		await super.handleDelete(ticketDocument);

		await this.client.bot.helpers
			.deleteChannel(ticketDocument.channelId)
			.catch((error) => this.log.warn(error, "Failed to delete ticket channel."));

		if (ticketDocument.type === "inquiry") {
			await this.#handleCloseInquiry(ticketDocument);
		}
	}

	async #handleCloseInquiry(ticketDocument: Ticket): Promise<void> {
		const entryRequestDocument = this.client.documents.entryRequests.get(
			Model.buildPartialId<EntryRequest>({
				guildId: ticketDocument.guildId,
				authorId: ticketDocument.authorId,
			}),
		);
		if (entryRequestDocument?.ticketChannelId === undefined) {
			return;
		}

		await entryRequestDocument.update(this.client, () => {
			entryRequestDocument.ticketChannelId = undefined;
		});
	}

	async openTicket({
		type,
		formData,
		user,
	}: {
		type: TicketType;
		formData: TicketFormData;
		user: Rost.User;
	}): Promise<Ticket | undefined> {
		const member = this.client.entities.members.get(this.guildId)?.get(user.id);
		if (member === undefined) {
			return undefined;
		}

		const categoryChannel = this.client.entities.channels.get(BigInt(this.configuration.categoryId));
		if (categoryChannel === undefined) {
			return undefined;
		}

		const strings = constants.contexts.inquiry({
			localise: this.client.localise,
			locale: this.guildLocale,
		});
		const channel = await this.client.bot.helpers
			.createChannel(this.guildId, {
				parentId: this.configuration.categoryId,
				name: trim(
					`${user.username}${constants.special.sigils.channelSeparator}${
						type === "standalone" ? formData.topic : strings.inquiry
					}`,
					100,
				),
				permissionOverwrites: [
					...categoryChannel.permissionOverwrites,
					{ type: Discord.OverwriteTypes.Member, id: user.id, allow: ["VIEW_CHANNEL"] },
				],
				topic: formData.topic,
			})
			.catch((error) => {
				this.client.log.warn(error, "Could not create a channel for ticket.");
				return undefined;
			});
		if (channel === undefined) {
			return undefined;
		}

		const memberMention = mention(user.id, { type: "user" });

		this.client.bot.helpers.sendMessage(channel.id, { content: memberMention }).catch((error) => {
			this.client.log.warn(error, "Failed to mention participants in ticket.");
			return undefined;
		});

		await this.client.bot.helpers
			.sendMessage(channel.id, {
				embeds: [
					{
						description: `${memberMention}: *${formData.topic}*`,
						color: constants.colours.husky,
					},
				],
			})
			.catch((error) => {
				this.client.log.warn(error, "Failed to send a topic message in the ticket channel.");
				return undefined;
			});

		if (type === "inquiry") {
			const entryRequest = this.client.documents.entryRequests.get(
				Model.buildPartialId<EntryRequest>({ guildId: this.guildIdString, authorId: user.id.toString() }),
			);
			if (entryRequest === undefined) {
				throw new Error(`Could not get entry request of ${this.client.diagnostics.user(user.id)}.`);
			}

			const strings = {
				...constants.contexts.verificationAnswers({
					localise: this.client.localise,
					locale: this.guildLocale,
				}),
				...constants.contexts.verificationModal({
					localise: this.client.localise,
					locale: this.guildLocale,
				}),
			};
			await this.client.bot.helpers.sendMessage(channel.id, {
				embeds: [
					{
						title: strings.verificationAnswers,
						color: constants.colours.husky,
						fields: [
							{
								name: strings.fields.reason,
								value: codeMultiline(entryRequest.formData.reason),
							},
							{
								name: strings.fields.aim,
								value: codeMultiline(entryRequest.formData.aim),
							},
							{
								name: strings.fields.whereFound,
								value: codeMultiline(entryRequest.formData.whereFound),
							},
						],
					},
				],
			});
		}

		const ticketDocument = await Ticket.create(this.client, {
			guildId: this.guildIdString,
			authorId: user.id.toString(),
			channelId: channel.id.toString(),
			type,
			formData,
		});

		switch (type) {
			case "standalone": {
				await this.client.tryLog("ticketOpen", {
					guildId: this.guildId,
					journalling: this.guildDocument.isJournalled("tickets"),
					args: [member, ticketDocument],
				});
				break;
			}
			case "inquiry": {
				await this.client.tryLog("inquiryOpen", {
					guildId: this.guildId,
					journalling: this.guildDocument.isJournalled("tickets"),
					args: [member, ticketDocument],
				});
				break;
			}
		}

		const prompt = await this.client.services
			.local("ticketPrompts", { guildId: this.guildId })
			.savePrompt(user, ticketDocument);
		if (prompt === undefined) {
			return undefined;
		}

		return ticketDocument;
	}
}

export { TicketPromptService };
