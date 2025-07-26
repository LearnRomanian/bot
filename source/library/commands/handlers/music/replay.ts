import type { Client } from "rost/client";
import { SongCollection } from "rost/services/music";

async function handleReplayAction(
	client: Client,
	interaction: Rost.Interaction<any, { collection: boolean | undefined }>,
): Promise<void> {
	const musicService = client.services.local("music", { guildId: interaction.guildId });
	if (!musicService.canManagePlayback(interaction)) {
		return;
	}

	if (!musicService.hasSession) {
		const strings = constants.contexts.noSongToReplay({ localise: client.localise, locale: interaction.locale });
		client.warning(interaction, { title: strings.title, description: strings.description }).ignore();

		return;
	}

	if (interaction.parameters.collection && !(musicService.session.queueable instanceof SongCollection)) {
		const strings = constants.contexts.noSongCollectionToReplay({
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

	const strings = constants.contexts.replaying({
		localise: client.localise,
		locale: interaction.guildLocale,
	});
	client
		.success(
			interaction,
			{
				title: `${constants.emojis.commands.music.replaying} ${strings.title}`,
				description: strings.description,
			},
			{ visible: true },
		)
		.ignore();

	await musicService.session.replay({
		mode: (interaction.parameters.collection ?? false) ? "song-collection" : "playable",
	});
}

export { handleReplayAction };
