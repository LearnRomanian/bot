import type { Client } from "rost/client";
import { SongCollection } from "rost/services/music";

async function handleSkipAction(
	client: Client,
	interaction: Rost.Interaction<
		any,
		{ collection: boolean | undefined; by: number | undefined; to: number | undefined }
	>,
): Promise<void> {
	const musicService = client.services.local("music", { guildId: interaction.guildId });
	if (!musicService.canManagePlayback(interaction)) {
		return;
	}

	if (!musicService.hasSession) {
		const strings = constants.contexts.noSongToSkip({ localise: client.localise, locale: interaction.locale });
		client.warning(interaction, { title: strings.title, description: strings.description }).ignore();

		return;
	}

	if (interaction.parameters.collection && !(musicService.session.queueable instanceof SongCollection)) {
		const strings = constants.contexts.noSongCollectionToSkip({
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
		const strings = constants.contexts.tooManySkipArguments({
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

	const isSkippingCollection = interaction.parameters.collection ?? false;

	let strings: { title: string; description: string };
	if (isSkippingCollection) {
		strings = constants.contexts.skippedSongCollection({
			localise: client.localise,
			locale: interaction.guildLocale,
		});
	} else {
		strings = constants.contexts.skippedSong({ localise: client.localise, locale: interaction.guildLocale });
	}
	client
		.success(
			interaction,
			{
				title: `${constants.emojis.commands.music.skipped} ${strings.title}`,
				description: strings.description,
			},
			{ visible: true },
		)
		.ignore();

	await musicService.session.skip({
		mode: interaction.parameters.collection ? "song-collection" : "playable",
		controls: { by: interaction.parameters.by, to: interaction.parameters.to },
	});
}

export { handleSkipAction };
