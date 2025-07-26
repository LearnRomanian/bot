import type { Client } from "rost/client";
import { SongCollection } from "rost/services/music";

async function handleLoopPlayback(
	client: Client,
	interaction: Rost.Interaction<any, { collection: boolean | undefined }>,
): Promise<void> {
	const musicService = client.services.local("music", { guildId: interaction.guildId });
	if (!musicService.canManagePlayback(interaction)) {
		return;
	}

	if (!musicService.hasSession) {
		const strings = constants.contexts.noSongToLoop({ localise: client.localise, locale: interaction.locale });
		client.warning(interaction, { title: strings.title, description: strings.description }).ignore();

		return;
	}

	if (interaction.parameters.collection && !(musicService.session.queueable instanceof SongCollection)) {
		const strings = constants.contexts.noSongCollectionToLoop({
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

	if (interaction.parameters.collection) {
		musicService.session.setLoop(!musicService.session.queueable.isLooping, { mode: "song-collection" });
	} else {
		musicService.session.setLoop(!musicService.session.playable.isLooping, { mode: "playable" });
	}

	if (interaction.parameters.collection) {
		if (!musicService.session.queueable.isLooping) {
			const strings = constants.contexts.loopDisabledForSongCollection({
				localise: client.localise,
				locale: interaction.guildLocale,
			});
			client
				.success(
					interaction,
					{
						title: `${constants.emojis.commands.music.loopDisabled} ${strings.title}`,
						description: strings.description,
					},
					{ visible: true },
				)
				.ignore();

			return;
		}

		const strings = constants.contexts.loopEnabledForSongCollection({
			localise: client.localise,
			locale: interaction.guildLocale,
		});
		client
			.success(
				interaction,
				{
					title: `${constants.emojis.commands.music.loopEnabled} ${strings.title}`,
					description: strings.description,
				},
				{ visible: true },
			)
			.ignore();

		return;
	}

	if (!musicService.session.playable.isLooping) {
		const strings = constants.contexts.loopDisabledForSong({
			localise: client.localise,
			locale: interaction.guildLocale,
		});
		client
			.success(
				interaction,
				{
					title: `${constants.emojis.commands.music.loopDisabled} ${strings.title}`,
					description: strings.description,
				},
				{ visible: true },
			)
			.ignore();

		return;
	}

	const strings = constants.contexts.loopEnabledForSong({
		localise: client.localise,
		locale: interaction.guildLocale,
	});
	client
		.success(
			interaction,
			{
				title: `${constants.emojis.commands.music.loopEnabled} ${strings.title}`,
				description: strings.description,
			},
			{ visible: true },
		)
		.ignore();
}

export { handleLoopPlayback };
