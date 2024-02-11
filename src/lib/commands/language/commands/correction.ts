import * as Discord from "@discordeno/bot";
import constants from "../../../../constants/constants";
import { Locale } from "../../../../constants/languages";
import { trim } from "../../../../formatting";
import * as Logos from "../../../../types";
import { Client } from "../../../client";
import diagnostics from "../../../diagnostics";
import {
	Modal,
	acknowledge,
	createInteractionCollector,
	createModalComposer,
	deleteReply,
	reply,
} from "../../../interactions";
import { getMemberAvatarURL } from "../../../utils";
import { CommandTemplate } from "../../command";
import categories from "../../social/roles/roles";
import { isImplicit, isSingle } from "../../social/roles/types";

const commands = {
	partial: {
		id: "correction.options.partial.message",
		type: Discord.ApplicationCommandTypes.Message,
		defaultMemberPermissions: ["VIEW_CHANNEL"],
		handle: (...args) => handleStartCorrecting(...args, "partial"),
	},
	full: {
		id: "correction.options.full.message",
		type: Discord.ApplicationCommandTypes.Message,
		defaultMemberPermissions: ["VIEW_CHANNEL"],
		handle: (...args) => handleStartCorrecting(...args, "full"),
	},
} satisfies Record<string, CommandTemplate>;

interface CorrectionData extends Record<string, string> {
	original: string;
	corrected: string;
}

type OpenMode = "partial" | "full";

async function handleStartCorrecting(
	client: Client,
	interaction: Logos.Interaction,
	openMode: OpenMode,
): Promise<void> {
	const locale = interaction.locale;

	const guildId = interaction.guildId;
	if (guildId === undefined) {
		return;
	}

	const member = client.entities.members.get(Discord.snowflakeToBigint(`${interaction.user.id}${guildId}`));
	if (member === undefined) {
		return;
	}

	const message = interaction.data?.resolved?.messages?.array()?.at(0);
	if (message === undefined) {
		return;
	}

	if (message.author.toggles?.has("bot") || message.content.trim().length === 0) {
		const strings = {
			title: client.localise("correction.strings.cannotCorrect.title", locale)(),
			description: client.localise("correction.strings.cannotCorrect.description", locale)(),
		};

		reply(client, interaction, {
			embeds: [
				{
					title: strings.title,
					description: strings.description,
					color: constants.colors.dullYellow,
				},
			],
		});
		return;
	}

	if (message.author.id === interaction.user.id) {
		const strings = {
			title: client.localise("correction.strings.cannotCorrectOwn.title", locale)(),
			description: client.localise("correction.strings.cannotCorrectOwn.description", locale)(),
		};

		reply(client, interaction, {
			embeds: [
				{
					title: strings.title,
					description: strings.description,
					color: constants.colors.dullYellow,
				},
			],
		});
		return;
	}

	const correctedMember = client.entities.members.get(Discord.snowflakeToBigint(`${message.author.id}${guildId}`));
	if (correctedMember === undefined) {
		return;
	}

	const learningRoleCategory = categories.find((category) => category.id === "roles.learning");
	if (
		learningRoleCategory !== undefined &&
		isSingle(learningRoleCategory) &&
		isImplicit(learningRoleCategory.collection)
	) {
		const doNotCorrectMeRoleId = learningRoleCategory.collection.list.find(
			(role) => role.id === "roles.learning.roles.doNotCorrectMe",
		)?.snowflakes[guildId.toString()];
		if (doNotCorrectMeRoleId !== undefined) {
			if (correctedMember.roles.some((roleId) => roleId.toString() === doNotCorrectMeRoleId)) {
				const strings = {
					title: client.localise("correction.strings.userDoesNotWantCorrections.title", locale)(),
					description: client.localise("correction.strings.userDoesNotWantCorrections.description", locale)(),
				};

				reply(client, interaction, {
					embeds: [
						{
							title: strings.title,
							description: strings.description,
							color: constants.colors.dullYellow,
						},
					],
				});
				return;
			}
		}
	}

	if (message.content.length > constants.MAXIMUM_CORRECTION_MESSAGE_LENGTH) {
		const strings = {
			title: client.localise("correction.strings.tooLong.title", locale)(),
			description: {
				tooLong: client.localise("correction.strings.tooLong.description.tooLong", locale)(),
				maximumLength: client.localise(
					"correction.strings.tooLong.description.maximumLength",
					locale,
				)({ character_limit: constants.MAXIMUM_CORRECTION_MESSAGE_LENGTH }),
			},
		};

		reply(client, interaction, {
			embeds: [
				{
					title: strings.title,
					description: `${strings.description.tooLong} ${strings.description.maximumLength}`,
					color: constants.colors.dullYellow,
				},
			],
		});
		return;
	}

	const data: CorrectionData = {
		original: message.content,
		corrected: "",
	};

	createModalComposer(client, interaction, {
		modal: generateCorrectionModal(client, data, openMode, { locale }),
		onSubmit: async (submission, data) => {
			if (data.corrected === data.original) {
				return "texts_not_different";
			}

			const strings = {
				correction: client.localise("correction.strings.correction", locale)(),
				suggestedBy: client.localise(
					"correction.strings.suggestedBy",
					locale,
				)({ username: diagnostics.display.user(interaction.user, { includeId: false }) }),
			};

			acknowledge(client, submission);

			client.bot.rest
				.sendMessage(message.channelId, {
					messageReference: { messageId: message.id, channelId: message.channelId, guildId, failIfNotExists: false },
					embeds: [
						{
							description: data.corrected,
							color: constants.colors.lightGreen,
							footer: {
								text: `${constants.symbols.correction} ${strings.suggestedBy}`,
								iconUrl: (() => {
									if (member.avatar !== undefined) {
										return getMemberAvatarURL(guildId, interaction.user.id, member.avatar);
									}

									return Discord.avatarUrl(interaction.user.id, interaction.user.discriminator, {
										avatar: interaction.user.avatar,
									});
								})(),
							},
						},
					],
				})
				.catch(() =>
					client.log.warn(`Failed to send correction to ${diagnostics.display.channel(message.channelId)}.`),
				);

			return true;
		},
		onInvalid: async (submission, error) => handleSubmittedInvalidCorrection(client, submission, error, { locale }),
	});
}

function generateCorrectionModal(
	client: Client,
	data: CorrectionData,
	openMode: OpenMode,
	{ locale }: { locale: Locale },
): Modal<CorrectionData> {
	const strings = {
		title: client.localise("correction.title", locale)(),
		original: client.localise("correction.fields.original", locale)(),
		corrected: client.localise("correction.fields.corrected", locale)(),
	};

	return {
		title: strings.title,
		fields: [
			{
				type: Discord.MessageComponentTypes.ActionRow,
				components: [
					{
						customId: "original",
						type: Discord.MessageComponentTypes.InputText,
						label: trim(strings.original, 45),
						value: data.original,
						style: Discord.TextStyles.Paragraph,
						required: false,
					},
				],
			},
			{
				type: Discord.MessageComponentTypes.ActionRow,
				components: [
					{
						customId: "corrected",
						type: Discord.MessageComponentTypes.InputText,
						label: trim(strings.corrected, 45),
						value: openMode === "full" ? data.original : undefined,
						style: Discord.TextStyles.Paragraph,
						required: true,
					},
				],
			},
		],
	};
}

async function handleSubmittedInvalidCorrection(
	client: Client,
	submission: Discord.Interaction,
	error: string | undefined,
	{ locale }: { locale: Locale },
): Promise<Discord.Interaction | undefined> {
	return new Promise((resolve) => {
		const continueId = createInteractionCollector(client, {
			type: Discord.InteractionTypes.MessageComponent,
			onCollect: async (selection) => {
				deleteReply(client, submission);
				resolve(selection);
			},
		});

		const cancelId = createInteractionCollector(client, {
			type: Discord.InteractionTypes.MessageComponent,
			onCollect: async (cancelSelection) => {
				const returnId = createInteractionCollector(client, {
					type: Discord.InteractionTypes.MessageComponent,
					onCollect: async (returnSelection) => {
						deleteReply(client, submission);
						deleteReply(client, cancelSelection);
						resolve(returnSelection);
					},
				});

				const leaveId = createInteractionCollector(client, {
					type: Discord.InteractionTypes.MessageComponent,
					onCollect: async (_) => {
						deleteReply(client, submission);
						deleteReply(client, cancelSelection);
						resolve(undefined);
					},
				});

				const strings = {
					title: client.localise("correction.strings.sureToCancel.title", locale)(),
					description: client.localise("correction.strings.sureToCancel.description", locale)(),
					stay: client.localise("prompts.stay", locale)(),
					leave: client.localise("prompts.leave", locale)(),
				};

				reply(client, cancelSelection, {
					embeds: [
						{
							title: strings.title,
							description: strings.description,
							color: constants.colors.dullYellow,
						},
					],
					components: [
						{
							type: Discord.MessageComponentTypes.ActionRow,
							components: [
								{
									type: Discord.MessageComponentTypes.Button,
									customId: returnId,
									label: strings.stay,
									style: Discord.ButtonStyles.Success,
								},
								{
									type: Discord.MessageComponentTypes.Button,
									customId: leaveId,
									label: strings.leave,
									style: Discord.ButtonStyles.Danger,
								},
							],
						},
					],
				});
			},
		});

		let embed!: Discord.CamelizedDiscordEmbed;
		switch (error) {
			case "texts_not_different": {
				const strings = {
					title: client.localise("correction.strings.textsNotDifferent.title", locale)(),
					description: client.localise("correction.strings.textsNotDifferent.description", locale)(),
				};

				embed = {
					title: strings.title,
					description: strings.description,
					color: constants.colors.dullYellow,
				};

				break;
			}
			default: {
				const strings = {
					title: client.localise("correction.strings.failed.title", locale)(),
					description: client.localise("correction.strings.failed.description", locale)(),
				};

				reply(client, submission, {
					embeds: [
						{
							title: strings.title,
							description: strings.description,
							color: constants.colors.dullYellow,
						},
					],
				});

				return;
			}
		}

		const strings = {
			continue: client.localise("prompts.continue", locale)(),
			cancel: client.localise("prompts.cancel", locale)(),
		};

		reply(client, submission, {
			embeds: [embed],
			components: [
				{
					type: Discord.MessageComponentTypes.ActionRow,
					components: [
						{
							type: Discord.MessageComponentTypes.Button,
							customId: continueId,
							label: strings.continue,
							style: Discord.ButtonStyles.Success,
						},
						{
							type: Discord.MessageComponentTypes.Button,
							customId: cancelId,
							label: strings.cancel,
							style: Discord.ButtonStyles.Danger,
						},
					],
				},
			],
		});
	});
}

export default commands;
