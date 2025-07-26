import type { Client } from "rost/client";
import { SongListingView } from "rost/commands/components/paginated-views/song-listing-view";

async function handleDisplayPlaybackQueue(client: Client, interaction: Rost.Interaction): Promise<void> {
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

	const strings = constants.contexts.queue({
		localise: client.localise,
		locale: interaction.parameters.show ? interaction.guildLocale : interaction.locale,
	});

	const view = new SongListingView(client, {
		interaction,
		title: `${constants.emojis.commands.music.list} ${strings.queue}`,
		listings: musicService.session.listings.queue.listings,
	});

	const refreshView = async () => view.refresh();
	const closeView = async () => view.close();

	musicService.session.listings.on("queue", refreshView);
	musicService.session.on("end", closeView);

	setTimeout(() => {
		musicService.session.listings.off("queue", refreshView);
		musicService.session.off("end", closeView);
	}, constants.discord.INTERACTION_TOKEN_EXPIRY);

	await view.open();
}

export { handleDisplayPlaybackQueue };
