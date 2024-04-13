import { Client } from "logos/client";
import { SongCollection } from "logos/services/music";

async function handleSkipAction(
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

	const musicService = client.getMusicService(interaction.guildId);
	if (musicService === undefined) {
		return;
	}

	const isVoiceStateVerified = musicService.verifyCanManagePlayback(interaction);
	if (!isVoiceStateVerified) {
		return;
	}

	if (!musicService.hasSession) {
		const locale = interaction.locale;
		const strings = {
			title: client.localise("music.strings.notPlaying.title", locale)(),
			description: {
				toManage: client.localise("music.strings.notPlaying.description.toManage", locale)(),
			},
		};

		await client.warning(interaction, {
			title: strings.title,
			description: strings.description.toManage,
		});

		return;
	}

	if (interaction.parameters.collection) {
		if (!(musicService.session.queueable instanceof SongCollection)) {
			const locale = interaction.locale;
			const strings = {
				title: client.localise("music.options.skip.strings.noSongCollection.title", locale)(),
				description: {
					noSongCollection: client.localise(
						"music.options.skip.strings.noSongCollection.description.noSongCollection",
						locale,
					)(),
					trySongInstead: client.localise(
						"music.options.skip.strings.noSongCollection.description.trySongInstead",
						locale,
					)(),
				},
			};

			await client.warning(interaction, {
				title: strings.title,
				description: `${strings.description.noSongCollection}\n\n${strings.description.trySongInstead}`,
			});

			return;
		}
	}

	// TODO(vxern): Remove this.
	/*
  else if (current?.content === undefined) {
		const locale = interaction.locale;
		const strings = {
			title: client.localise("music.options.skip.strings.noSong.title", locale)(),
			description: client.localise("music.options.skip.strings.noSong.description", locale)(),
		};

		await client.warning(interaction, {
			title: strings.title,
			description: strings.description,
		});

		return;
	}*/

	// If both the 'to' and the 'by' parameter have been supplied.
	if (interaction.parameters.by !== undefined && interaction.parameters.to !== undefined) {
		const locale = interaction.locale;
		const strings = {
			title: client.localise("music.strings.skips.tooManyArguments.title", locale)(),
			description: client.localise("music.strings.skips.tooManyArguments.description", locale)(),
		};

		await client.warning(interaction, {
			title: strings.title,
			description: strings.description,
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

		await client.error(interaction, {
			title: strings.title,
			description: strings.description,
		});

		return;
	}

	const isSkippingCollection = interaction.parameters.collection ?? false;
	const strings = isSkippingCollection
		? {
				title: client.localise("music.options.skip.strings.skippedSongCollection.title", locale)(),
				description: client.localise("music.options.skip.strings.skippedSongCollection.description", locale)(),
		  }
		: {
				title: client.localise("music.options.skip.strings.skippedSong.title", locale)(),
				description: client.localise("music.options.skip.strings.skippedSong.description", locale)(),
		  };

	await client.success(
		interaction,
		{
			title: `${constants.emojis.music.skipped} ${strings.title}`,
			description: strings.description,
		},
		{ visible: true },
	);

	if (interaction.parameters.by !== undefined) {
		let listingsToSkip!: number;
		if (musicService.session.queueable instanceof SongCollection && interaction.parameters.collection === undefined) {
			listingsToSkip = Math.min(
				interaction.parameters.by,
				musicService.session.queueable.songs.length - (musicService.session.queueable.position + 1),
			);
		} else {
			listingsToSkip = Math.min(interaction.parameters.by, musicService.session.listings.queue.listings.length);
		}
		await musicService.session.skip({
			mode: isSkippingCollection ? "song-collection" : "playable",
			controls: { by: listingsToSkip },
		});
	} else if (interaction.parameters.to !== undefined) {
		let listingToSkipTo!: number;
		if (musicService.session.queueable instanceof SongCollection && interaction.parameters.collection === undefined) {
			listingToSkipTo = Math.min(interaction.parameters.to, musicService.session.queueable.songs.length);
		} else {
			listingToSkipTo = Math.min(interaction.parameters.to, musicService.session.listings.queue.listings.length);
		}
		await musicService.session.skip({
			mode: isSkippingCollection ? "song-collection" : "playable",
			controls: { to: listingToSkipTo },
		});
	} else {
		await musicService.session.skip({ mode: isSkippingCollection ? "song-collection" : "playable", controls: {} });
	}
}

export { handleSkipAction };
