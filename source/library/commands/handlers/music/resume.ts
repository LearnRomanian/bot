import type { Client } from "rost/client";

async function handleResumePlayback(client: Client, interaction: Rost.Interaction): Promise<void> {
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

	if (!musicService.session.player.paused) {
		const strings = constants.contexts.notPaused({
			localise: client.localise,
			locale: interaction.locale,
		});
		client.warning(interaction, { title: strings.title, description: strings.description }).ignore();

		return;
	}

	await musicService.session.setPaused(false);

	const strings = constants.contexts.resumed({ localise: client.localise, locale: interaction.guildLocale });
	client
		.success(
			interaction,
			{
				title: `${constants.emojis.commands.music.resumed} ${strings.title}`,
				description: strings.description,
			},
			{ visible: true },
		)
		.ignore();
}

export { handleResumePlayback };
