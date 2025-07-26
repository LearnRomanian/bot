import type { Client } from "rost/client";
import { SongCollection } from "rost/services/music";

async function handleUnskipAction(
	client: Client,
	interaction: Rost.Interaction<
		any,
		{ collection: boolean | undefined; by: number | undefined; to: number | undefined }
	>,
): Promise<void> {
	if (interaction.parameters.by !== undefined && !Number.isSafeInteger(interaction.parameters.by)) {
		return;
	}

	if (interaction.parameters.to !== undefined && !Number.isSafeInteger(interaction.parameters.to)) {
		return;
	}

	const musicService = client.services.local("music", { guildId: interaction.guildId });
	if (!musicService.canManagePlayback(interaction)) {
		return;
	}

	if (!musicService.hasSession) {
		const strings = constants.contexts.notPlayingMusicToManage({
			localise: client.localise,
			locale: interaction.locale,
		});
		client.warning(interaction, { title: strings.title, description: strings.description }).ignore();

		return;
	}

	const isUnskippingListing = (() => {
		if (!musicService.session.hasCurrent) {
			return true;
		}

		if (!(musicService.session.queueable instanceof SongCollection)) {
			return true;
		}

		return interaction.parameters.collection || musicService.session.queueable.index === 0;
	})();

	if (isUnskippingListing && musicService.session.listings.history.isEmpty) {
		const strings = constants.contexts.unskipHistoryEmpty({
			localise: client.localise,
			locale: interaction.locale,
		});
		client.warning(interaction, { title: strings.title, description: strings.description }).ignore();

		return;
	}

	if (musicService.session.listings.queue.isFull) {
		const strings = constants.contexts.unskipQueueFull({ localise: client.localise, locale: interaction.locale });
		client.warning(interaction, { title: strings.title, description: strings.description }).ignore();

		return;
	}

	if (
		interaction.parameters.collection !== undefined &&
		!(musicService.session.queueable instanceof SongCollection)
	) {
		const strings = constants.contexts.noSongCollectionToUnskip({
			localise: client.localise,
			locale: interaction.locale,
		});
		client
			.warning(interaction, {
				title: strings.title,
				description: `${strings.description.noSongCollection}\n\n${strings.description.trySongInstead}`,
			})
			.ignore();

		return;
	}

	// If both the 'to' and the 'by' parameter have been supplied.
	if (interaction.parameters.by !== undefined && interaction.parameters.to !== undefined) {
		const strings = constants.contexts.tooManyUnskipArguments({
			localise: client.localise,
			locale: interaction.locale,
		});
		client.warning(interaction, { title: strings.title, description: strings.description }).ignore();

		return;
	}

	// If either the 'to' parameter or the 'by' parameter are negative.
	if (
		(interaction.parameters.by !== undefined && interaction.parameters.by <= 0) ||
		(interaction.parameters.to !== undefined && interaction.parameters.to <= 0)
	) {
		const strings = constants.contexts.invalidSkipArgument({
			localise: client.localise,
			locale: interaction.locale,
		});
		client.error(interaction, { title: strings.title, description: strings.description }).ignore();

		return;
	}

	const strings = constants.contexts.unskipped({
		localise: client.localise,
		locale: interaction.guildLocale,
	});
	client
		.success(
			interaction,
			{
				title: `${constants.emojis.commands.music.unskipped} ${strings.title}`,
				description: strings.description,
			},
			{ visible: true },
		)
		.ignore();

	await musicService.session.unskip({
		mode: interaction.parameters.collection ? "song-collection" : "playable",
		controls: { by: interaction.parameters.by, to: interaction.parameters.to },
	});
}

export { handleUnskipAction };
