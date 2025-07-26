import { mention, timestamp, trim } from "rost:constants/formatting";
import { isValidSnowflake } from "rost:constants/patterns";
import type { Client } from "rost/client";
import { InteractionCollector } from "rost/collectors";
import { Guild } from "rost/models/guild";

async function handlePurgeMessagesAutocomplete(
	client: Client,
	interaction: Rost.Interaction<any, { author: string | undefined }>,
): Promise<void> {
	if (interaction.parameters.author === undefined) {
		return;
	}

	await client.autocompleteMembers(interaction, {
		identifier: interaction.parameters.author,
		options: { includeBots: true },
	});
}

async function handlePurgeMessages(
	client: Client,
	interaction: Rost.Interaction<any, { start: string; end: string; author: string | undefined }>,
): Promise<void> {
	await client.postponeReply(interaction);

	let authorId: bigint | undefined;
	if (interaction.parameters.author !== undefined) {
		const authorMember = client.resolveInteractionToMember(interaction, {
			identifier: interaction.parameters.author,
			options: { includeBots: true },
		});
		if (authorMember === undefined) {
			return;
		}

		authorId = authorMember.id;
	} else {
		authorId = undefined;
	}

	const isStartValid = isValidSnowflake(interaction.parameters.start);
	const isEndValid = interaction.parameters.end === undefined || isValidSnowflake(interaction.parameters.end);
	if (!(isStartValid && isEndValid)) {
		await displaySnowflakesInvalidError(client, interaction, [!isStartValid, !isEndValid]);
		return;
	}

	const end =
		interaction.parameters.end ??
		(await client.bot.helpers
			.getMessages(interaction.channelId, { limit: 1 })
			.catch((error) => {
				client.log.error(error, "Failed to fetch latest message for purging.");
				return undefined;
			})
			.then((messages) => messages?.at(0)?.id?.toString()));

	if (end === undefined) {
		const strings = constants.contexts.purgeFailed({ localise: client.localise, locale: interaction.locale });
		client.failed(interaction, { title: strings.title, description: strings.description }).ignore();

		return;
	}

	if (interaction.parameters.start === end) {
		const strings = constants.contexts.idsNotDifferent({ localise: client.localise, locale: interaction.locale });
		client.warned(interaction, { title: strings.title, description: strings.description }).ignore();

		return;
	}

	let [startMessageId, endMessageId] = [
		Discord.snowflakeToBigint(interaction.parameters.start),
		Discord.snowflakeToBigint(end),
	];

	if (startMessageId > endMessageId) {
		[startMessageId, endMessageId] = [endMessageId, startMessageId];
	}

	const [startTimestamp, endTimestamp] = [
		Discord.snowflakeToTimestamp(startMessageId),
		Discord.snowflakeToTimestamp(endMessageId),
	];

	const now = Date.now();

	const isStartInFuture = startTimestamp > now;
	const isEndInFuture = endTimestamp > now;
	if (isStartInFuture || isEndInFuture) {
		await displaySnowflakesInvalidError(client, interaction, [isStartInFuture, isEndInFuture]);
		return;
	}

	const [startMessage, endMessage] = await Promise.all([
		client.bot.helpers.getMessage(interaction.channelId, startMessageId).catch((error) => {
			client.log.warn(error, `Failed to get start message, ID ${startMessageId}.`);
			return undefined;
		}),
		client.bot.helpers.getMessage(interaction.channelId, endMessageId).catch((error) => {
			client.log.warn(error, `Failed to get end message, ID ${endMessageId}.`);
			return undefined;
		}),
	]);

	const notExistsStart = startMessage === undefined;
	const notExistsEnd = endMessage === undefined;
	if (notExistsStart || notExistsEnd) {
		await displaySnowflakesInvalidError(client, interaction, [notExistsStart, notExistsEnd]);
		return;
	}

	const channelMention = mention(interaction.channelId, { type: "channel" });

	const [startMessageContent, endMessageContent] = [
		getMessageContent(client, interaction, startMessage),
		getMessageContent(client, interaction, endMessage),
	];

	let messages: Discord.Message[] = [];

	const getMessageFields = (): Discord.Camelize<Discord.DiscordEmbedField>[] => {
		const strings = constants.contexts.purge({ localise: client.localise, locale: interaction.locale });
		return [
			{
				name: strings.start,
				value:
					startMessageContent !== undefined
						? `${startMessageContent}\n${strings.posted({
								relative_timestamp: timestamp(startMessage.timestamp, {
									format: "relative",
								}),
								user_mention: mention(BigInt(startMessage.author.id), { type: "user" }),
							})}`
						: strings.embedPosted({
								relative_timestamp: timestamp(startMessage.timestamp, {
									format: "relative",
								}),
								user_mention: mention(BigInt(startMessage.author.id), { type: "user" }),
							}),
			},
			{
				name: strings.end,
				value:
					endMessageContent !== undefined
						? `${endMessageContent}\n${strings.posted({
								relative_timestamp: timestamp(endMessage.timestamp, { format: "relative" }),
								user_mention: mention(BigInt(endMessage.author.id), { type: "user" }),
							})}`
						: strings.embedPosted({
								relative_timestamp: timestamp(endMessage.timestamp, { format: "relative" }),
								user_mention: mention(BigInt(endMessage.author.id), { type: "user" }),
							}),
			},
			{
				name: strings.messagesFound,
				value: messages.length.toString(),
			},
		];
	};

	const getIndexingProgressResponse = (): Discord.InteractionCallbackData => {
		const strings = constants.contexts.indexing({ localise: client.localise, locale: interaction.locale });
		return {
			embeds: [
				{
					title: strings.title,
					description: strings.description,
					color: constants.colours.notice,
					fields: getMessageFields(),
				},
			],
		};
	};

	client.editReply(interaction, getIndexingProgressResponse()).ignore();

	const indexProgressIntervalId = setInterval(
		() => client.editReply(interaction, getIndexingProgressResponse()).ignore(),
		1500,
	);

	let isFinished = false;
	while (!isFinished) {
		if (messages.length >= constants.MAXIMUM_INDEXABLE_MESSAGES) {
			clearInterval(indexProgressIntervalId);

			const strings = constants.contexts.rangeTooBig({ localise: client.localise, locale: interaction.locale });
			client
				.warned(interaction, {
					title: strings.title,
					description: `${strings.description.rangeTooBig({
						messages: client.pluralise(
							"purge.strings.rangeTooBig.description.rangeTooBig.messages",
							interaction.locale,
							{
								quantity: constants.MAXIMUM_INDEXABLE_MESSAGES,
							},
						),
					})}\n\n${strings.description.trySmaller}`,
				})
				.ignore();

			return;
		}

		const newMessages = await client.bot.helpers
			.getMessages(interaction.channelId, {
				after: messages.length === 0 ? startMessage.id : messages.at(-1)?.id,
				limit: 100,
			})
			.then((collection) => Array.from(collection.values()).reverse())
			.catch((error) => {
				client.log.warn(
					error,
					`Failed to get messages starting with ${client.diagnostics.message(startMessage.id)}.`,
				);

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
			authorId !== undefined
				? messagesInRange.filter((message) => BigInt(message.author.id) === authorId)
				: messagesInRange;
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

	if (authorId === undefined || BigInt(startMessage.author.id) === authorId) {
		messages.unshift(startMessage);
	}

	clearInterval(indexProgressIntervalId);

	if (messages.length === 0) {
		const strings = constants.contexts.indexedNoResults({ localise: client.localise, locale: interaction.locale });
		client
			.warned(interaction, {
				title: strings.title,
				description: `${strings.description.none}\n\n${strings.description.tryDifferentQuery}`,
				fields: getMessageFields(),
			})
			.ignore();

		return;
	}

	let shouldContinue = false;

	if (messages.length >= constants.MAXIMUM_DELETABLE_MESSAGES) {
		const { promise, resolve } = Promise.withResolvers<boolean>();

		const continueButton = new InteractionCollector(client, { only: [interaction.user.id], isSingle: true });
		const cancelButton = new InteractionCollector(client, { only: [interaction.user.id], isSingle: true });

		continueButton.onInteraction(async (buttonPress) => {
			client.acknowledge(buttonPress).ignore();

			resolve(true);
		});

		cancelButton.onInteraction(async (buttonPress) => {
			client.acknowledge(buttonPress).ignore();

			resolve(false);
		});

		continueButton.onDone(() => resolve(false));
		cancelButton.onDone(() => resolve(false));

		await client.registerInteractionCollector(continueButton);
		await client.registerInteractionCollector(cancelButton);

		const strings = constants.contexts.tooManyMessagesToDelete({
			localise: client.localise,
			locale: interaction.locale,
		});
		client
			.editReply(interaction, {
				embeds: [
					{
						title: strings.indexed.title,
						description: `${strings.indexed.description.tooMany({
							messages: client.pluralise(
								"purge.strings.indexed.description.tooMany.messages",
								interaction.locale,
								{
									quantity: messages.length,
								},
							),
							maximum_deletable: constants.MAXIMUM_DELETABLE_MESSAGES,
						})}\n\n${strings.indexed.description.limited({
							messages: client.pluralise(
								"purge.strings.indexed.description.limited.messages",
								interaction.locale,
								{
									quantity: constants.MAXIMUM_DELETABLE_MESSAGES,
								},
							),
						})}`,
						color: constants.colours.pushback,
						fields: getMessageFields(),
					},
					{
						title: strings.continue.title,
						description: strings.continue.description({
							messages: client.pluralise(
								"purge.strings.indexed.description.limited.messages",
								interaction.locale,
								{
									quantity: constants.MAXIMUM_DELETABLE_MESSAGES,
								},
							),
						}),
						color: constants.colours.pushback,
					},
				],
				components: [
					{
						type: Discord.MessageComponentTypes.ActionRow,
						components: [
							{
								type: Discord.MessageComponentTypes.Button,
								customId: continueButton.customId,
								label: strings.yes,
								style: Discord.ButtonStyles.Success,
							},
							{
								type: Discord.MessageComponentTypes.Button,
								customId: cancelButton.customId,
								label: strings.no,
								style: Discord.ButtonStyles.Danger,
							},
						],
					},
				],
			})
			.ignore();

		shouldContinue = await promise;
		if (!shouldContinue) {
			client.deleteReply(interaction).ignore();

			return;
		}

		messages = messages.slice(0, constants.MAXIMUM_DELETABLE_MESSAGES);
	}

	if (!shouldContinue) {
		const { promise, resolve } = Promise.withResolvers<boolean>();

		const continueButton = new InteractionCollector(client, { only: [interaction.user.id], isSingle: true });
		const cancelButton = new InteractionCollector(client, { only: [interaction.user.id], isSingle: true });

		continueButton.onInteraction(async (buttonPress) => {
			client.acknowledge(buttonPress).ignore();

			resolve(true);
		});

		cancelButton.onInteraction(async (buttonPress) => {
			client.acknowledge(buttonPress).ignore();

			resolve(false);
		});

		continueButton.onDone(() => resolve(false));
		cancelButton.onDone(() => resolve(false));

		await client.registerInteractionCollector(continueButton);
		await client.registerInteractionCollector(cancelButton);

		const strings = constants.contexts.indexedFoundMessagesToDelete({
			localise: client.localise,
			locale: interaction.locale,
		});
		client
			.editReply(interaction, {
				embeds: [
					{
						title: strings.indexed.title,
						description: strings.indexed.description.some({
							messages: client.pluralise(
								"purge.strings.indexed.description.some.messages",
								interaction.locale,
								{
									quantity: messages.length,
								},
							),
						}),
						color: constants.colours.notice,
						fields: getMessageFields(),
					},
					{
						title: strings.sureToPurge.title,
						description: strings.sureToPurge.description({
							messages: client.pluralise(
								"purge.strings.sureToPurge.description.messages",
								interaction.locale,
								{
									quantity: messages.length,
								},
							),
							channel_mention: channelMention,
						}),
						color: constants.colours.pushback,
					},
				],
				components: [
					{
						type: Discord.MessageComponentTypes.ActionRow,
						components: [
							{
								type: Discord.MessageComponentTypes.Button,
								customId: continueButton.customId,
								label: strings.yes,
								style: Discord.ButtonStyles.Success,
							},
							{
								type: Discord.MessageComponentTypes.Button,
								customId: cancelButton.customId,
								label: strings.no,
								style: Discord.ButtonStyles.Danger,
							},
						],
					},
				],
			})
			.ignore();

		const isShouldPurge = await promise;
		if (!isShouldPurge) {
			client.deleteReply(interaction).ignore();

			return;
		}
	}

	{
		const strings = constants.contexts.purging({ localise: client.localise, locale: interaction.locale });
		client
			.noticed(interaction, {
				embeds: [
					{
						title: strings.title,
						description: `${strings.description.purging({
							messages: client.pluralise(
								"purge.strings.purging.description.purging.messages",
								interaction.locale,
								{
									quantity: messages.length,
								},
							),
							channel_mention: channelMention,
						})} ${strings.description.mayTakeTime}\n\n${strings.description.onceComplete}`,
					},
				],
				// Passing an empty array here removes the components.
				components: [],
			})
			.ignore();
	}

	client.log.info(
		`Purging ${messages.length} messages in ${client.diagnostics.channel(
			interaction.channelId,
		)} as requested by ${client.diagnostics.user(interaction.user)}...`,
	);

	const [guild, member, channel] = [
		client.entities.guilds.get(interaction.guildId),
		client.entities.members.get(interaction.guildId)?.get(interaction.user.id),
		client.entities.channels.get(interaction.channelId),
	];
	if (guild === undefined || member === undefined || channel === undefined) {
		return;
	}

	const guildDocument = await Guild.getOrCreate(client, { guildId: interaction.guildId.toString() });
	await client.tryLog("purgeBegin", {
		guildId: guild.id,
		journalling: guildDocument.isJournalled("purging"),
		args: [member, channel, messages.length],
	});

	const twoWeeksAgo = now - constants.time.week * 2 + constants.time.hour;

	const firstBulkDeletableIndex = messages.findIndex((message) => message.timestamp > twoWeeksAgo);
	const bulkDeletable =
		firstBulkDeletableIndex !== -1 ? messages.slice(firstBulkDeletableIndex, messages.length) : [];
	const nonBulkDeletable = messages.slice(
		0,
		firstBulkDeletableIndex !== -1 ? firstBulkDeletableIndex : messages.length,
	);

	let responseDeleted = false;

	const responseDeletionTimeoutId = setTimeout(async () => {
		responseDeleted = true;

		client.deleteReply(interaction).ignore();
	}, constants.time.minute);

	let deletedCount = 0;

	if (bulkDeletable.length < 2) {
		nonBulkDeletable.push(...bulkDeletable.splice(0));
	} else {
		const bulkDeletableChunks = bulkDeletable.toChunked(100);
		for (const chunk of bulkDeletableChunks) {
			const messageIds = chunk.map((message) => message.id);

			await client.bot.helpers.deleteMessages(interaction.channelId, messageIds).catch((error) => {
				client.log.warn(
					error,
					`Failed to delete ${messageIds.length} messages from ${client.diagnostics.channel(
						interaction.channelId,
					)}.`,
				);
			});

			await new Promise((resolve) => setTimeout(resolve, 1000));

			deletedCount += messageIds.length;
		}
	}

	for (const message of nonBulkDeletable) {
		await client.bot.helpers
			.deleteMessage(interaction.channelId, message.id)
			.catch((error) => client.log.warn(error, `Failed to delete ${client.diagnostics.message(message)}.`));

		await new Promise((resolve) => setTimeout(resolve, 1000));

		deletedCount += 1;
	}

	client.log.info(
		`Purged ${deletedCount}/${messages.length} messages in ${client.diagnostics.channel(
			interaction.channelId,
		)} as requested by ${client.diagnostics.user(interaction.user)}.`,
	);

	await client.tryLog("purgeEnd", {
		guildId: guild.id,
		journalling: guildDocument.isJournalled("purging"),
		args: [member, channel, deletedCount],
	});

	clearTimeout(responseDeletionTimeoutId);

	if (responseDeleted) {
		return;
	}

	{
		const strings = constants.contexts.purged({ localise: client.localise, locale: interaction.locale });
		client
			.succeeded(interaction, {
				title: strings.title,
				description: strings.description({
					messages: client.pluralise("purge.strings.purged.description.messages", interaction.locale, {
						quantity: deletedCount,
					}),
					channel_mention: channelMention,
				}),
				image: { url: constants.gifs.done },
			})
			.ignore();
	}
}

async function displaySnowflakesInvalidError(
	client: Client,
	interaction: Rost.Interaction,
	[isStartInvalid, isEndInvalid]: [boolean, boolean],
): Promise<void> {
	const areBothInvalid = isStartInvalid && isEndInvalid;

	const strings = constants.contexts.invalidPurgeParameters({
		localise: client.localise,
		locale: interaction.locale,
	});
	client
		.warned(
			interaction,
			(() => {
				if (areBothInvalid) {
					return { title: strings.both.title, description: strings.both.description };
				}

				if (isStartInvalid) {
					return { title: strings.start.title, description: strings.start.description };
				}

				return { title: strings.end.title, description: strings.end.description };
			})(),
		)
		.ignore();
}

function getMessageContent(
	client: Client,
	interaction: Rost.Interaction,
	message: Discord.Message,
): string | undefined {
	if (message.content?.trim().length === 0 && (message.embeds?.length ?? 0) > 0) {
		return undefined;
	}

	const content = trim(message.content ?? "", 500).trim();
	if (content.length === 0) {
		const strings = constants.contexts.purgeNoContent({ localise: client.localise, locale: interaction.locale });
		return `> *${strings.noContent}*`;
	}

	return `> ${content}`;
}

export { handlePurgeMessages, handlePurgeMessagesAutocomplete };
