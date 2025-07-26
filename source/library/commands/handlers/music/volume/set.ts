import type { Client } from "rost/client";

async function handleSetVolume(client: Client, interaction: Rost.Interaction<any, { volume: number }>): Promise<void> {
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

	if (!Number.isSafeInteger(interaction.parameters.volume)) {
		return;
	}

	if (interaction.parameters.volume < 0 || interaction.parameters.volume > constants.MAXIMUM_VOLUME) {
		const strings = constants.contexts.volumeInvalid({
			localise: client.localise,
			locale: interaction.locale,
		});
		client
			.error(interaction, {
				title: strings.title,
				description: strings.description({ volume: constants.MAXIMUM_VOLUME }),
			})
			.ignore();

		return;
	}

	await musicService.session.setVolume(interaction.parameters.volume);

	const strings = constants.contexts.volumeSet({
		localise: client.localise,
		locale: interaction.locale,
	});
	client
		.success(
			interaction,
			{
				title: `${constants.emojis.commands.music.volume} ${strings.title}`,
				description: strings.description({ volume: interaction.parameters.volume }),
			},
			{ visible: true },
		)
		.ignore();
}

export { handleSetVolume };
