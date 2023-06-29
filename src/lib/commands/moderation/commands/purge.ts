import {
	ApplicationCommandOptionTypes,
	ApplicationCommandTypes,
	Bot,
	ButtonStyles,
	deleteMessage,
	deleteMessages,
	Embed,
	getMessage,
	getMessages,
	Interaction,
	InteractionCallbackData,
	InteractionTypes,
	Message,
	MessageComponentTypes,
	snowflakeToBigint,
} from "discordeno";
import { CommandTemplate } from "../../command.js";
import { user } from "../../parameters.js";
import { logEvent } from "../../../controllers/logging/logging.js";
import {
	autocompleteMembers,
	Client,
	isValidSnowflake,
	localise,
	resolveInteractionToMember,
} from "../../../client.js";
import {
	acknowledge,
	createInteractionCollector,
	deleteReply,
	editReply,
	parseArguments,
	postponeReply,
} from "../../../interactions.js";
import { chunk, diagnosticMentionUser, snowflakeToTimestamp } from "../../../utils.js";
import configuration from "../../../../configuration.js";
import constants, { Periods } from "../../../../constants.js";
import { mention, MentionTypes, timestamp, trim } from "../../../../formatting.js";

const command: CommandTemplate = {
	name: "purge",
	type: ApplicationCommandTypes.ChatInput,
	defaultMemberPermissions: ["MODERATE_MEMBERS"],
	handle: handlePurgeMessages,
	handleAutocomplete: handlePurgeMessagesAutocomplete,
	options: [
		{
			name: "start",
			type: ApplicationCommandOptionTypes.String,
			required: true,
		},
		{
			name: "end",
			type: ApplicationCommandOptionTypes.String,
		},
		{ ...user, name: "author", required: false },
	],
};

async function handlePurgeMessagesAutocomplete([client, bot]: [Client, Bot], interaction: Interaction): Promise<void> {
	const [{ author }] = parseArguments(interaction.data?.options, {});

	autocompleteMembers([client, bot], interaction, author!, { includeBots: true });
}

async function handlePurgeMessages([client, bot]: [Client, Bot], interaction: Interaction): Promise<void> {
	let [{ start, end, author: user }] = parseArguments(interaction.data?.options, {});

	postponeReply([client, bot], interaction);

	let authorId: bigint | undefined;

	if (user !== undefined) {
		const authorMember = resolveInteractionToMember([client, bot], interaction, user, {
			includeBots: true,
		});
		if (authorMember === undefined) {
			return;
		}

		authorId = authorMember.id;
	} else {
		authorId = undefined;
	}

	const isStartValid = isValidSnowflake(start!);
	const isEndValid = end === undefined || isValidSnowflake(end!);
	if (!(isStartValid && isEndValid)) {
		displaySnowflakesInvalidError([client, bot], interaction, [!isStartValid, !isEndValid]);
		return;
	}

	end =
		end ??
		(await getMessages(bot, interaction.channelId!, { limit: 1 })
			.catch(() => undefined)
			.then((messages) => messages?.first()?.id?.toString()));

	if (end === undefined) {
		displayFailedError([client, bot], interaction);
		return;
	}

	if (start === end) {
		displayIdsNotDifferentError([client, bot], interaction);
		return;
	}

	let [startMessageId, endMessageId] = [snowflakeToBigint(start!), snowflakeToBigint(end!)];

	if (startMessageId > endMessageId) {
		[startMessageId, endMessageId] = [endMessageId, startMessageId];
	}

	const [startTimestamp, endTimestamp] = [snowflakeToTimestamp(startMessageId), snowflakeToTimestamp(endMessageId)];

	const now = Date.now();

	const isStartInFuture = startTimestamp > now;
	const isEndInFuture = endTimestamp > now;
	if (isStartInFuture || isEndInFuture) {
		displaySnowflakesInvalidError([client, bot], interaction, [isStartInFuture, isEndInFuture]);
		return;
	}

	const [startMessage, endMessage] = await Promise.all([
		getMessage(bot, interaction.channelId!, startMessageId).catch(() => {
			client.log.warn(`Failed to get start message, ID ${startMessageId}.`);

			return undefined;
		}),
		getMessage(bot, interaction.channelId!, endMessageId).catch(() => {
			client.log.warn(`Failed to get end message, ID ${endMessageId}.`);

			return undefined;
		}),
	]);

	const notExistsStart = startMessage === undefined;
	const notExistsEnd = endMessage === undefined;
	if (notExistsStart || notExistsEnd) {
		displaySnowflakesInvalidError([client, bot], interaction, [notExistsStart, notExistsEnd]);
		return;
	}

	const channelMention = mention(interaction.channelId!, MentionTypes.Channel);

	const [startMessageContent, endMessageContent] = [
		getMessageContent(client, startMessage, interaction.locale),
		getMessageContent(client, endMessage, interaction.locale),
	];

	let messages: Message[] = [];

	const getMessageFields = (): NonNullable<Embed["fields"]> => {
		const strings = {
			start: localise(client, "purge.strings.start", interaction.locale)(),
			postedStart: (startMessageContent !== undefined
				? localise(client, "purge.strings.posted", interaction.locale)
				: localise(client, "purge.strings.embedPosted", interaction.locale))({
				relative_timestamp: timestamp(startMessage.timestamp),
				user_mention: mention(startMessage.authorId, MentionTypes.User),
			}),
			end: localise(client, "purge.strings.end", interaction.locale)(),
			postedEnd: (endMessageContent !== undefined
				? localise(client, "purge.strings.posted", interaction.locale)
				: localise(client, "purge.strings.embedPosted", interaction.locale))({
				relative_timestamp: timestamp(endMessage.timestamp),
				user_mention: mention(endMessage.authorId, MentionTypes.User),
			}),
			messagesFound: localise(client, "purge.strings.messagesFound", interaction.locale)(),
		};

		return [
			{
				name: strings.start,
				value:
					startMessageContent !== undefined ? `${startMessageContent}\n${strings.postedStart}` : strings.postedStart,
			},
			{
				name: strings.end,
				value: endMessageContent !== undefined ? `${endMessageContent}\n${strings.postedEnd}` : strings.postedEnd,
			},
			{
				name: strings.messagesFound,
				value: messages.length.toString(),
			},
		];
	};

	const getIndexingProgressResponse = (): InteractionCallbackData => {
		const strings = {
			indexing: {
				title: localise(client, "purge.strings.indexing.title", interaction.locale)(),
				description: localise(client, "purge.strings.indexing.description", interaction.locale)(),
			},
		};

		return {
			embeds: [
				{
					title: strings.indexing.title,
					description: strings.indexing.description,
					fields: getMessageFields(),
					color: constants.colors.peach,
				},
			],
		};
	};

	editReply([client, bot], interaction, getIndexingProgressResponse());

	const indexProgressIntervalId = setInterval(
		() => editReply([client, bot], interaction, getIndexingProgressResponse()),
		1500,
	);

	let isFinished = false;
	while (!isFinished) {
		if (messages.length >= configuration.commands.purge.maxFound) {
			clearInterval(indexProgressIntervalId);

			const strings = {
				title: localise(client, "purge.strings.rangeTooBig.title", interaction.locale)(),
				description: {
					rangeTooBig: localise(
						client,
						"purge.strings.rangeTooBig.description.rangeTooBig",
						interaction.locale,
					)({
						number: configuration.commands.purge.maxFound,
					}),
					trySmaller: localise(client, "purge.strings.rangeTooBig.description.trySmaller", interaction.locale)(),
				},
			};

			editReply([client, bot], interaction, {
				embeds: [
					{
						title: strings.title,
						description: `${strings.description.rangeTooBig}\n\n${strings.description.trySmaller}`,
						color: constants.colors.yellow,
					},
				],
			});
			return;
		}

		const newMessages = await getMessages(bot, interaction.channelId!, {
			after: messages.length === 0 ? startMessage.id : messages.at(-1)!.id,
			limit: 100,
		})
			.then((collection) => Array.from(collection.values()).reverse())
			.catch((reason) => {
				client.log.warn(`Failed to get messages starting with message with ID ${startMessage.id}: ${reason}`);

				return [];
			});
		if (newMessages.length === 0) {
			isFinished = true;
			continue;
		}

		const lastMessageInRangeIndex = newMessages.findLastIndex((message) => message.id <= endMessage.id);
		const messagesInRange = newMessages.slice(0, lastMessageInRangeIndex + 1);

		if (messagesInRange.length === 0) {
			isFinished = true;
		}

		const messagesToDelete =
			authorId !== undefined ? messagesInRange.filter((message) => message.authorId === authorId) : messagesInRange;
		messages.push(...messagesToDelete);

		// If the chunk is incomplete or if not all of it is relevant,
		// there are no more relevant messages; therefore finished.
		if (messagesInRange.length < 100) {
			isFinished = true;
		}

		// If the end message has been found, there are no more relevant messages; therefore finished.
		if (messagesInRange.at(-1)?.id === endMessage.id) {
			isFinished = true;
		}
	}

	if (authorId === undefined || startMessage.authorId === authorId) {
		messages.unshift(startMessage);
	}

	clearInterval(indexProgressIntervalId);

	if (messages.length === 0) {
		const strings = {
			indexed: {
				title: localise(client, "purge.strings.indexed.title", interaction.locale)(),
				description: {
					none: localise(client, "purge.strings.indexed.description.none", interaction.locale)(),
					tryDifferentQuery: localise(
						client,
						"purge.strings.indexed.description.tryDifferentQuery",
						interaction.locale,
					)(),
				},
			},
		};

		editReply([client, bot], interaction, {
			embeds: [
				{
					title: strings.indexed.title,
					description: `${strings.indexed.description.none}\n\n${strings.indexed.description.tryDifferentQuery}`,
					fields: getMessageFields(),
					color: constants.colors.husky,
				},
			],
		});
		return;
	}

	let isShouldContinue = false;

	if (messages.length >= configuration.commands.purge.maxDeletable) {
		isShouldContinue = await new Promise<boolean>((resolve) => {
			const continueId = createInteractionCollector([client, bot], {
				type: InteractionTypes.MessageComponent,
				onCollect: async (_, selection) => {
					acknowledge([client, bot], selection);
					resolve(true);
				},
			});

			const cancelId = createInteractionCollector([client, bot], {
				type: InteractionTypes.MessageComponent,
				onCollect: async (_, selection) => {
					acknowledge([client, bot], selection);
					resolve(false);
				},
			});

			const strings = {
				indexed: {
					title: localise(client, "purge.strings.indexed.title", interaction.locale)(),
					description: {
						tooMany: localise(client, "purge.strings.indexed.description.tooMany", interaction.locale),
						limited: localise(client, "purge.strings.indexed.description.limited", interaction.locale),
					},
				},
				continue: {
					title: localise(client, "purge.strings.continue.title", interaction.locale)(),
					description: localise(client, "purge.strings.continue.description", interaction.locale),
				},
				yes: localise(client, "purge.strings.yes", interaction.locale)(),
				no: localise(client, "purge.strings.no", interaction.locale)(),
			};

			editReply([client, bot], interaction, {
				embeds: [
					{
						title: strings.indexed.title,
						description: `${strings.indexed.description.tooMany({
							number: messages.length,
							maximum_deletable: configuration.commands.purge.maxDeletable,
						})}\n\n${strings.indexed.description.limited({
							number: configuration.commands.purge.maxDeletable,
						})}`,
						fields: getMessageFields(),
						color: constants.colors.yellow,
					},
					{
						title: strings.continue.title,
						description: strings.continue.description({
							number: configuration.commands.purge.maxDeletable,
							channel_mention: channelMention,
							full_number: messages.length,
						}),
						color: constants.colors.husky,
					},
				],
				components: [
					{
						type: MessageComponentTypes.ActionRow,
						components: [
							{
								type: MessageComponentTypes.Button,
								customId: continueId,
								label: strings.yes,
								style: ButtonStyles.Success,
							},
							{
								type: MessageComponentTypes.Button,
								customId: cancelId,
								label: strings.no,
								style: ButtonStyles.Danger,
							},
						],
					},
				],
			});
		});

		if (!isShouldContinue) {
			deleteReply([client, bot], interaction);
			return;
		}

		messages = messages.slice(0, configuration.commands.purge.maxDeletable);
	}

	const isShouldPurge =
		isShouldContinue ||
		(await new Promise<boolean>((resolve) => {
			const continueId = createInteractionCollector([client, bot], {
				type: InteractionTypes.MessageComponent,
				onCollect: async (_, selection) => {
					acknowledge([client, bot], selection);
					resolve(true);
				},
			});

			const cancelId = createInteractionCollector([client, bot], {
				type: InteractionTypes.MessageComponent,
				onCollect: async (_, selection) => {
					acknowledge([client, bot], selection);
					resolve(false);
				},
			});

			const strings = {
				indexed: {
					title: localise(client, "purge.strings.indexed.title", interaction.locale)(),
					description: {
						some: localise(client, "purge.strings.indexed.description.some", interaction.locale),
					},
				},
				sureToPurge: {
					title: localise(client, "purge.strings.sureToPurge.title", interaction.locale)(),
					description: localise(client, "purge.strings.sureToPurge.description", interaction.locale),
				},
				yes: localise(client, "purge.strings.yes", interaction.locale)(),
				no: localise(client, "purge.strings.no", interaction.locale)(),
			};

			editReply([client, bot], interaction, {
				embeds: [
					{
						title: strings.indexed.title,
						description: strings.indexed.description.some({ number: messages.length }),
						fields: getMessageFields(),
						color: constants.colors.blue,
					},
					{
						title: strings.sureToPurge.title,
						description: strings.sureToPurge.description({
							number: messages.length,
							channel_mention: channelMention,
						}),
						color: constants.colors.husky,
					},
				],
				components: [
					{
						type: MessageComponentTypes.ActionRow,
						components: [
							{
								type: MessageComponentTypes.Button,
								customId: continueId,
								label: strings.yes,
								style: ButtonStyles.Success,
							},
							{
								type: MessageComponentTypes.Button,
								customId: cancelId,
								label: strings.no,
								style: ButtonStyles.Danger,
							},
						],
					},
				],
			});
		}));

	if (!isShouldPurge) {
		deleteReply([client, bot], interaction);
		return;
	}

	{
		const strings = {
			purging: {
				title: localise(client, "purge.strings.purging.title", interaction.locale)(),
				description: {
					purging: localise(client, "purge.strings.purging.description.purging", interaction.locale),
					mayTakeTime: localise(client, "purge.strings.purging.description.mayTakeTime", interaction.locale)(),
					onceComplete: localise(client, "purge.strings.purging.description.onceComplete", interaction.locale)(),
				},
			},
		};

		editReply([client, bot], interaction, {
			embeds: [
				{
					title: strings.purging.title,
					description: `${strings.purging.description.purging({
						number: messages.length,
						channel_mention: channelMention,
					})} ${strings.purging.description.mayTakeTime}\n\n${strings.purging.description.onceComplete}`,
					color: constants.colors.blue,
				},
			],
			components: [],
		});
	}

	client.log.info(
		`Purging ${
			messages.length
		} message(s) in channel ID ${interaction.channelId!} as requested by ${diagnosticMentionUser(interaction.user)}...`,
	);

	const [guild, member, channel] = [
		client.cache.guilds.get(interaction.guildId!),
		client.cache.members.get(snowflakeToBigint(`${interaction.user.id}${interaction.guildId!}`)),
		client.cache.channels.get(interaction.channelId!),
	];
	if (guild === undefined || member === undefined || channel === undefined) {
		return;
	}

	logEvent([client, bot], guild, "purgeBegin", [member, channel, messages.length]);

	const twoWeeksAgo = now - Periods.week * 2 + Periods.hour;

	const firstBulkDeletableIndex = messages.findIndex((message) => message.timestamp > twoWeeksAgo);
	const bulkDeletable = firstBulkDeletableIndex !== -1 ? messages.slice(firstBulkDeletableIndex, messages.length) : [];
	const nonBulkDeletable = messages.slice(
		0,
		firstBulkDeletableIndex !== -1 ? firstBulkDeletableIndex : messages.length,
	);

	let responseDeleted = false;

	const responseDeletionTimeoutId = setTimeout(async () => {
		responseDeleted = true;
		deleteReply([client, bot], interaction);
	}, Periods.minute * 1);

	let deletedCount = 0;

	if (bulkDeletable.length < 2) {
		nonBulkDeletable.push(...bulkDeletable.splice(0));
	} else {
		const bulkDeletableChunks = chunk(bulkDeletable, 100);
		for (const chunk of bulkDeletableChunks) {
			const messageIds = chunk.map((message) => message.id);

			await deleteMessages(bot, interaction.channelId!, messageIds).catch((reason) => {
				client.log.warn(
					`Failed to delete ${messageIds.length} message(s) from channel with ID ${interaction.channelId!}: ${reason}`,
				);
			});

			await new Promise((resolve) => setTimeout(resolve, 400));

			deletedCount += messageIds.length;
		}
	}

	for (const message of nonBulkDeletable) {
		await deleteMessage(bot, interaction.channelId!, message.id).catch((reason) =>
			client.log.warn(`Failed to delete message with ID ${message.id}: ${reason}`),
		);

		await new Promise((resolve) => setTimeout(resolve, 400));

		deletedCount += 1;
	}

	client.log.info(
		`Purged ${deletedCount}/${
			messages.length
		} message(s) in channel ID ${interaction.channelId!} as requested by ${diagnosticMentionUser(interaction.user)}.`,
	);

	logEvent([client, bot], guild, "purgeEnd", [member, channel, deletedCount]);

	clearTimeout(responseDeletionTimeoutId);

	if (responseDeleted) {
		return;
	}

	{
		const strings = {
			purged: {
				title: localise(client, "purge.strings.purged.title", interaction.locale)(),
				description: localise(client, "purge.strings.purged.description", interaction.locale),
			},
		};

		editReply([client, bot], interaction, {
			embeds: [
				{
					title: strings.purged.title,
					description: strings.purged.description({ number: deletedCount, channel_mention: channelMention }),
					color: constants.colors.lightGreen,
					image: { url: constants.gifs.done },
				},
			],
		});
	}
}

async function displaySnowflakesInvalidError(
	[client, bot]: [Client, Bot],
	interaction: Interaction,
	[isStartInvalid, isEndInvalid]: [boolean, boolean],
): Promise<void> {
	const strings = {
		start: {
			title: localise(client, "purge.strings.invalid.start.title", interaction.locale)(),
			description: localise(client, "purge.strings.invalid.start.description", interaction.locale)(),
		},
		end: {
			title: localise(client, "purge.strings.invalid.end.title", interaction.locale)(),
			description: localise(client, "purge.strings.invalid.end.description", interaction.locale)(),
		},
		both: {
			title: localise(client, "purge.strings.invalid.both.title", interaction.locale)(),
			description: localise(client, "purge.strings.invalid.both.description", interaction.locale)(),
		},
	};

	const areBothInvalid = isStartInvalid && isEndInvalid;

	editReply([client, bot], interaction, {
		embeds: [
			{
				...(areBothInvalid
					? {
							title: strings.both.title,
							description: strings.both.description,
					  }
					: isStartInvalid
					? {
							title: strings.start.title,
							description: strings.start.description,
					  }
					: {
							title: strings.end.title,
							description: strings.end.description,
					  }),
				color: constants.colors.red,
			},
		],
	});
}

async function displayIdsNotDifferentError([client, bot]: [Client, Bot], interaction: Interaction): Promise<void> {
	const strings = {
		title: localise(client, "purge.strings.idsNotDifferent.title", interaction.locale)(),
		description: localise(client, "purge.strings.idsNotDifferent.description", interaction.locale)(),
	};

	editReply([client, bot], interaction, {
		embeds: [
			{
				title: strings.title,
				description: strings.description,
				color: constants.colors.red,
			},
		],
	});
}

async function displayFailedError([client, bot]: [Client, Bot], interaction: Interaction): Promise<void> {
	const strings = {
		title: localise(client, "purge.strings.failed.title", interaction.locale)(),
		description: localise(client, "purge.strings.failed.description", interaction.locale)(),
	};

	editReply([client, bot], interaction, {
		embeds: [
			{
				title: strings.title,
				description: strings.description,
				color: constants.colors.red,
			},
		],
	});
}

function getMessageContent(client: Client, message: Message, locale: string | undefined): string | undefined {
	if (message.content.trim().length === 0 && message.embeds.length !== 0) {
		return undefined;
	}

	const content = trim(message.content, 500).trim();
	if (content.length === 0) {
		const strings = {
			noContent: localise(client, "purge.strings.noContent", locale)(),
		};

		return `> *${strings.noContent}*`;
	}

	return `> ${content}`;
}

export default command;
