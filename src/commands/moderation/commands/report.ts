import {
	ApplicationCommandFlags,
	Bot,
	ButtonStyles,
	deleteOriginalInteractionResponse,
	editOriginalInteractionResponse,
	Embed,
	Interaction,
	InteractionResponseTypes,
	InteractionTypes,
	Member,
	MessageComponentTypes,
	sendInteractionResponse,
	sendMessage,
	TextStyles,
	User as DiscordUser,
} from 'discordeno';
import { Commands, createLocalisations, localise, Modals } from 'logos/assets/localisations/mod.ts';
import { CommandBuilder } from 'logos/src/commands/command.ts';
import { User } from 'logos/src/database/structs/mod.ts';
import { stringifyValue } from 'logos/src/database/database.ts';
import { Document } from 'logos/src/database/document.ts';
import {
	authorIdByMessageId,
	getReportPrompt,
	messageIdByReportReferenceId,
	reportByMessageId,
} from 'logos/src/services/reports.ts';
import { Client, isValidIdentifier, resolveIdentifierToMembers } from 'logos/src/client.ts';
import { createInteractionCollector, createModalComposer, Modal } from 'logos/src/interactions.ts';
import constants from 'logos/constants.ts';
import { trim } from 'logos/formatting.ts';
import configuration from 'logos/configuration.ts';
import { getTextChannel, verifyIsWithinLimits } from 'logos/src/utils.ts';

const command: CommandBuilder = {
	...createLocalisations(Commands.report),
	defaultMemberPermissions: ['VIEW_CHANNEL'],
	handle: handleInitiateReportProcess,
};

enum ReportError {
	Failure = 'failure',
	UsersSpecifiedIncorrectly = 'users_specified_incorrectly',
	UserSpecifiedMoreThanOnce = 'user_specified_more_than_once',
	TooManyUsersSpecified = 'too_many_users_specified',
	CannotReportSelf = 'cannot_report_self',
}

async function handleInitiateReportProcess(
	[client, bot]: [Client, Bot],
	interaction: Interaction,
): Promise<void> {
	const guild = client.cache.guilds.get(interaction.guildId!);
	if (guild === undefined) return;

	const authorDocument = await client.database.adapters.users.getOrFetchOrCreate(
		client,
		'id',
		interaction.user.id.toString(),
		interaction.user.id,
	);
	if (authorDocument === undefined) return;

	const reportsByAuthorAndGuild = client.database.adapters.reports.get(
		client,
		'authorAndGuild',
		[authorDocument.ref, guild.id.toString()],
	);
	if (reportsByAuthorAndGuild !== undefined) {
		const reports = Array.from(reportsByAuthorAndGuild.values());
		if (!verifyIsWithinLimits(reports, configuration.commands.report.limitUses, configuration.commands.report.within)) {
			return void sendInteractionResponse(
				bot,
				interaction.id,
				interaction.token,
				{
					type: InteractionResponseTypes.ChannelMessageWithSource,
					data: {
						flags: ApplicationCommandFlags.Ephemeral,
						embeds: [{
							description: localise(Commands.report.strings.waitBeforeReporting, interaction.locale),
							color: constants.colors.dullYellow,
						}],
					},
				},
			);
		}
	}

	return void createModalComposer([client, bot], interaction, {
		modal: generateReportModal(interaction.locale),
		onSubmit: async (submission, answers) => {
			await sendInteractionResponse(bot, submission.id, submission.token, {
				type: InteractionResponseTypes.DeferredChannelMessageWithSource,
				data: {
					flags: ApplicationCommandFlags.Ephemeral,
				},
			});

			const userReportString = answers.users_to_report!;
			if (!validateUserReportString(userReportString)) {
				return ReportError.UsersSpecifiedIncorrectly;
			}

			const usersToReport = parseUserReportString(client, guild.id, answers.users_to_report!);
			if (usersToReport === undefined) return ReportError.Failure;

			for (const [user, index] of usersToReport.map<[DiscordUser, number]>((user, index) => [user, index])) {
				if (usersToReport.findLastIndex((user_) => user_.id === user.id) !== index) {
					return ReportError.UserSpecifiedMoreThanOnce;
				}
			}

			const recipients = await Promise.all(
				usersToReport.map((user) =>
					client.database.adapters.users.getOrFetchOrCreate(client, 'id', user.id.toString(), user.id)
				),
			).then((recipients) => recipients.includes(undefined) ? undefined : recipients as unknown as Document<User>[]);
			if (recipients === undefined) return ReportError.Failure;

			if (recipients.some((recipient) => recipient.data.account.id === authorDocument.data.account.id)) {
				return ReportError.CannotReportSelf;
			}

			const report = await client.database.adapters.reports.create(
				client,
				{
					author: authorDocument.ref,
					guild: guild.id.toString(),
					recipients: recipients.map((recipient) => recipient.ref),
					reason: answers.reason!,
					messageLink: answers.message_link,
					isResolved: false,
				},
			);
			if (report === undefined) return ReportError.Failure;

			const reportChannelId = getTextChannel(guild, configuration.guilds.channels.reports)?.id;
			if (reportChannelId === undefined) return true;

			const recipientIds = recipients.map((recipient) => BigInt(recipient.data.account.id));

			const messageId = await sendMessage(
				bot,
				reportChannelId,
				getReportPrompt(bot, guild, interaction.user, recipientIds, report),
			).then((message) => message.id);

			const reportReferenceId = stringifyValue(report.ref);

			reportByMessageId.set(messageId, report);
			authorIdByMessageId.set(messageId, interaction.user.id);
			messageIdByReportReferenceId.set(reportReferenceId, messageId);

			editOriginalInteractionResponse(bot, submission.token, {
				flags: ApplicationCommandFlags.Ephemeral,
				embeds: [{
					title: localise(Commands.report.strings.reportSubmitted.header, interaction.locale),
					description: localise(Commands.report.strings.reportSubmitted.body, interaction.locale),
					color: constants.colors.lightGreen,
				}],
			});

			return true;
		},
		// deno-lint-ignore require-await
		onInvalid: async (submission, error) =>
			handleSubmittedInvalidReport([client, bot], submission, error as ReportError | undefined),
	});
}

function handleSubmittedInvalidReport(
	[client, bot]: [Client, Bot],
	submission: Interaction,
	error: ReportError | undefined,
): Promise<Interaction | undefined> {
	return new Promise((resolve) => {
		const continueId = createInteractionCollector([client, bot], {
			type: InteractionTypes.MessageComponent,
			onCollect: (_bot, selection) => {
				deleteOriginalInteractionResponse(bot, submission.token);
				resolve(selection);
			},
		});

		const cancelId = createInteractionCollector([client, bot], {
			type: InteractionTypes.MessageComponent,
			onCollect: (_bot, cancelSelection) => {
				const returnId = createInteractionCollector([client, bot], {
					type: InteractionTypes.MessageComponent,
					onCollect: (_bot, returnSelection) => resolve(returnSelection),
				});

				const leaveId = createInteractionCollector([client, bot], {
					type: InteractionTypes.MessageComponent,
					onCollect: (_bot, _leaveSelection) => {
						deleteOriginalInteractionResponse(bot, submission.token);
						deleteOriginalInteractionResponse(bot, cancelSelection.token);
						resolve(undefined);
					},
				});

				sendInteractionResponse(bot, cancelSelection.id, cancelSelection.token, {
					type: InteractionResponseTypes.ChannelMessageWithSource,
					data: {
						flags: ApplicationCommandFlags.Ephemeral,
						embeds: [{
							description: localise(Commands.report.strings.areYouSureToStopSubmitting, cancelSelection.locale),
							color: constants.colors.dullYellow,
						}],
						components: [{
							type: MessageComponentTypes.ActionRow,
							components: [{
								type: MessageComponentTypes.Button,
								customId: returnId,
								label: localise(Modals.prompts.noTakeMeBackToTheComposer, cancelSelection.locale),
								style: ButtonStyles.Success,
							}, {
								type: MessageComponentTypes.Button,
								customId: leaveId,
								label: localise(Modals.prompts.yesLeaveTheComposer, cancelSelection.locale),
								style: ButtonStyles.Danger,
							}],
						}],
					},
				});
			},
		});

		let embed!: Embed;
		switch (error) {
			case ReportError.Failure:
			default: {
				editOriginalInteractionResponse(bot, submission.token, {
					embeds: [{
						description: localise(Commands.report.strings.failedToSubmitReport, submission.locale),
						color: constants.colors.dullYellow,
					}],
				});
				break;
			}
			case ReportError.UsersSpecifiedIncorrectly: {
				embed = {
					description: localise(
						Commands.report.strings.specifiedUsersIncorrectly('`username#1234, 123456789123456789, Wumpus`'),
						submission.locale,
					),
					color: constants.colors.dullYellow,
				};
				break;
			}
			case ReportError.UserSpecifiedMoreThanOnce: {
				embed = {
					description: localise(Commands.report.strings.specifiedUserMoreThanOnce, submission.locale),
					color: constants.colors.dullYellow,
				};
				break;
			}
			case ReportError.CannotReportSelf: {
				embed = {
					description: localise(Commands.report.strings.cannotSubmitReportAgainstSelf, submission.locale),
					color: constants.colors.dullYellow,
				};
			}
		}

		editOriginalInteractionResponse(bot, submission.token, {
			embeds: [embed],
			components: [{
				type: MessageComponentTypes.ActionRow,
				components: [{
					type: MessageComponentTypes.Button,
					customId: continueId,
					label: localise(Modals.prompts.continue, submission.locale),
					style: ButtonStyles.Success,
				}, {
					type: MessageComponentTypes.Button,
					customId: cancelId,
					label: localise(Modals.prompts.cancel, submission.locale),
					style: ButtonStyles.Danger,
				}],
			}],
		});
	});
}

function generateReportModal<T extends string>(locale: string | undefined): Modal<T> {
	return {
		title: localise(Modals.report.title, locale),
		fields: [{
			type: MessageComponentTypes.ActionRow,
			components: [{
				customId: 'reason',
				type: MessageComponentTypes.InputText,
				label: trim(localise(Modals.report.fields.reason, locale), 45),
				style: TextStyles.Paragraph,
				required: true,
				minLength: 20,
				maxLength: 300,
			}],
		}, {
			type: MessageComponentTypes.ActionRow,
			components: [{
				customId: 'users_to_report',
				type: MessageComponentTypes.InputText,
				label: trim(localise(Modals.report.fields.usersToReport, locale), 45),
				style: TextStyles.Short,
				required: true,
				maxLength: 200,
			}],
		}, {
			type: MessageComponentTypes.ActionRow,
			components: [{
				customId: 'message_link',
				type: MessageComponentTypes.InputText,
				label: trim(localise(Modals.report.fields.linkToMessage, locale), 45),
				style: TextStyles.Short,
				required: false,
				maxLength: 100,
			}],
		}],
	} as Modal<T>;
}

function validateUserReportString(userString: string): boolean {
	return userString
		.split(',')
		.map((identifier) => identifier.trim())
		.every((identifier) => isValidIdentifier(identifier));
}

function parseUserReportString(client: Client, guildId: bigint, userString: string): DiscordUser[] | undefined {
	const identifiers = userString.split(',').map((identifier) => identifier.trim());
	const members = identifiers.map((identifier) => resolveIdentifierToMembers(client, guildId, identifier)?.[0]?.[0]);
	if (members.includes(undefined)) return undefined;
	return (members as Member[]).map((member) => member.user!);
}

export default command;
