import { Client } from "logos/client";
import { isCollection } from "logos/services/music";

async function handleUnskipAction(
	client: Client,
	interaction: Logos.Interaction<
		any,
		{ collection: boolean | undefined; by: number | undefined; to: number | undefined }
	>,
): Promise<void> {
	const locale = interaction.guildLocale;

	if (interaction.parameters.by !== undefined && !Number.isSafeInteger(interaction.parameters.by)) {
		return;
	}

	if (interaction.parameters.to !== undefined && !Number.isSafeInteger(interaction.parameters.to)) {
		return;
	}

	const guildId = interaction.guildId;
	if (guildId === undefined) {
		return;
	}

	const musicService = client.getMusicService(guildId);
	if (musicService === undefined) {
		return;
	}

	const isVoiceStateVerified = musicService.verifyCanManagePlayback(interaction);
	if (!isVoiceStateVerified) {
		return;
	}

	const isOccupied = musicService.isOccupied;
	if (!isOccupied) {
		const locale = interaction.locale;
		const strings = {
			title: client.localise("music.strings.notPlaying.title", locale)(),
			description: {
				toManage: client.localise("music.strings.notPlaying.description.toManage", locale)(),
			},
		};

		client.reply(interaction, {
			embeds: [
				{
					title: strings.title,
					description: strings.description.toManage,
					color: constants.colours.dullYellow,
				},
			],
		});
		return;
	}

	const [history, current, isQueueVacant, isHistoryEmpty] = [
		musicService.history,
		musicService.current,
		musicService.isQueueVacant,
		musicService.isHistoryEmpty,
	];
	if (history === undefined || isQueueVacant === undefined || isHistoryEmpty === undefined) {
		return;
	}

	const isUnskippingListing = (() => {
		if (current === undefined) {
			return true;
		}

		if (!isCollection(current.content)) {
			return true;
		}

		if (interaction.parameters.collection !== undefined || current.content.position === 0) {
			return true;
		}

		return false;
	})();

	if (isUnskippingListing && isHistoryEmpty) {
		const locale = interaction.locale;
		const strings = {
			title: client.localise("music.options.unskip.strings.historyEmpty.title", locale)(),
			description: client.localise("music.options.unskip.strings.historyEmpty.description", locale)(),
		};

		await client.reply(interaction, {
			embeds: [
				{
					title: strings.title,
					description: strings.description,
					color: constants.colours.dullYellow,
				},
			],
		});

		return;
	}

	if (
		interaction.parameters.collection !== undefined &&
		(current === undefined || current.content === undefined || !isCollection(current.content))
	) {
		const locale = interaction.locale;
		const strings = {
			title: client.localise("music.options.unskip.strings.noSongCollection.title", locale)(),
			description: {
				noSongCollection: client.localise(
					"music.options.unskip.strings.noSongCollection.description.noSongCollection",
					locale,
				)(),
				trySongInstead: client.localise(
					"music.options.unskip.strings.noSongCollection.description.trySongInstead",
					locale,
				)(),
			},
		};

		await client.reply(interaction, {
			embeds: [
				{
					title: strings.title,
					description: `${strings.description.noSongCollection}\n\n${strings.description.trySongInstead}`,
					color: constants.colours.dullYellow,
				},
			],
		});

		return;
	}

	if (!isQueueVacant) {
		const locale = interaction.locale;
		const strings = {
			title: client.localise("music.options.unskip.strings.queueFull.title", locale)(),
			description: client.localise("music.options.unskip.strings.queueFull.description", locale)(),
		};

		await client.reply(interaction, {
			embeds: [
				{
					title: strings.title,
					description: strings.description,
					color: constants.colours.dullYellow,
				},
			],
		});

		return;
	}

	// If both the 'to' and the 'by' parameter have been supplied.
	if (interaction.parameters.by !== undefined && interaction.parameters.to !== undefined) {
		const locale = interaction.locale;
		const strings = {
			title: client.localise("music.strings.skips.tooManyArguments.title", locale)(),
			description: client.localise("music.strings.skips.tooManyArguments.description", locale)(),
		};

		await client.reply(interaction, {
			embeds: [
				{
					title: strings.title,
					description: strings.description,
					color: constants.colours.yellow,
				},
			],
		});

		return;
	}

	// If either the 'to' parameter or the 'by' parameter are negative.
	if (
		(interaction.parameters.by !== undefined && interaction.parameters.by <= 0) ||
		(interaction.parameters.to !== undefined && interaction.parameters.to <= 0)
	) {
		const locale = interaction.locale;
		const strings = {
			title: client.localise("music.strings.skips.invalid.title", locale)(),
			description: client.localise("music.strings.skips.invalid.description", locale)(),
		};

		await client.reply(interaction, {
			embeds: [
				{
					title: strings.title,
					description: strings.description,
					color: constants.colours.red,
				},
			],
		});

		return;
	}

	const strings = {
		title: client.localise("music.options.unskip.strings.unskipped.title", locale)(),
		description: client.localise("music.options.unskip.strings.unskipped.description", locale)(),
	};

	await client.reply(
		interaction,
		{
			embeds: [
				{
					title: `${constants.emojis.music.unskipped} ${strings.title}`,
					description: strings.description,
					color: constants.colours.blue,
				},
			],
		},
		{ visible: true },
	);

	const isUnskippingCollection = interaction.parameters.collection ?? false;

	if (isUnskippingListing) {
		await musicService.unskip(isUnskippingCollection, { by: interaction.parameters.by, to: interaction.parameters.to });
	} else {
		if (interaction.parameters.by !== undefined) {
			let listingsToUnskip!: number;
			if (
				current !== undefined &&
				current.content !== undefined &&
				isCollection(current.content) &&
				interaction.parameters.collection === undefined
			) {
				listingsToUnskip = Math.min(interaction.parameters.by, current.content.position);
			} else {
				listingsToUnskip = Math.min(interaction.parameters.by, history.length);
			}
			await musicService.unskip(isUnskippingCollection, { by: listingsToUnskip });
		} else if (interaction.parameters.to !== undefined) {
			let listingToSkipTo!: number;
			if (
				current !== undefined &&
				current.content !== undefined &&
				isCollection(current.content) &&
				interaction.parameters.collection === undefined
			) {
				listingToSkipTo = Math.max(interaction.parameters.to, 1);
			} else {
				listingToSkipTo = Math.min(interaction.parameters.to, history.length);
			}
			await musicService.unskip(isUnskippingCollection, { to: listingToSkipTo });
		} else {
			await musicService.unskip(isUnskippingCollection, {});
		}
	}
}

export { handleUnskipAction };
