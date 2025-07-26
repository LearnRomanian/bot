import type { Client } from "rost/client";

async function handleDisplayVolume(client: Client, interaction: Rost.Interaction): Promise<void> {
	const musicService = client.services.local("music", { guildId: interaction.guildId });
	if (!musicService.canCheckPlayback(interaction)) {
		return;
	}

	if (!musicService.hasSession) {
		const strings = constants.contexts.notPlayingMusicToCheck({
			localise: client.localise,
			locale: interaction.locale,
		});
		client.warning(interaction, { title: strings.title, description: strings.description }).ignore();

		return;
	}

	const strings = constants.contexts.volume({
		localise: client.localise,
		locale: interaction.parameters.show ? interaction.guildLocale : interaction.locale,
	});

	const components: Discord.ActionRow[] | undefined = interaction.parameters.show
		? undefined
		: [
				{
					type: Discord.MessageComponentTypes.ActionRow,
					components: [client.services.global("interactionRepetition").getShowButton(interaction)],
				},
			];

	client
		.notice(
			interaction,
			{
				embeds: [
					{
						title: `${constants.emojis.commands.music.volume} ${strings.title}`,
						description: strings.description({ volume: musicService.session.player.volume }),
					},
				],
				components,
			},
			{ visible: interaction.parameters.show },
		)
		.ignore();
}

export { handleDisplayVolume };
