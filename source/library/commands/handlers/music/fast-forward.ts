import type { Client } from "rost/client";
import { handleAutocompleteTimestamp } from "rost/commands/fragments/autocomplete/timestamp";

async function handleFastForwardAutocomplete(
	client: Client,
	interaction: Rost.Interaction<any, { timestamp: string }>,
): Promise<void> {
	await handleAutocompleteTimestamp(client, interaction);
}

async function handleFastForward(
	client: Client,
	interaction: Rost.Interaction<any, { timestamp: string }>,
): Promise<void> {
	const musicService = client.services.local("music", { guildId: interaction.guildId });
	if (!musicService.canManagePlayback(interaction)) {
		return;
	}

	if (!musicService.hasSession) {
		const strings = constants.contexts.noSongToFastForward({
			localise: client.localise,
			locale: interaction.locale,
		});
		client.warning(interaction, { title: strings.title, description: strings.description }).ignore();

		return;
	}

	const timestamp = Number(interaction.parameters.timestamp);
	if (!Number.isSafeInteger(timestamp)) {
		const strings = constants.contexts.invalidFastForwardTimestamp({
			localise: client.localise,
			locale: interaction.locale,
		});
		client.error(interaction, { title: strings.title, description: strings.description }).ignore();

		return;
	}

	await musicService.session.skipTo({ timestamp: musicService.session.player.position + timestamp });

	const strings = constants.contexts.noSongToFastForward({
		localise: client.localise,
		locale: interaction.guildLocale,
	});
	client
		.success(
			interaction,
			{
				title: `${constants.emojis.commands.music.fastForwarded} ${strings.title}`,
				description: strings.description,
			},
			{ visible: true },
		)
		.ignore();
}

export { handleFastForward, handleFastForwardAutocomplete };
