import type { Client } from "rost/client";
import { handleResumePlayback } from "rost/commands/handlers/music/resume";

async function handlePausePlayback(client: Client, interaction: Rost.Interaction): Promise<void> {
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

	if (musicService.session.player.paused) {
		await handleResumePlayback(client, interaction);
		return;
	}

	await musicService.session.setPaused(true);

	const strings = constants.contexts.musicPaused({
		localise: client.localise,
		locale: interaction.guildLocale,
	});

	client
		.notice(
			interaction,
			{
				title: `${constants.emojis.commands.music.paused} ${strings.title}`,
				description: strings.description,
			},
			{ visible: true },
		)
		.ignore();
}

export { handlePausePlayback };
