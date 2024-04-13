import { Client } from "logos/client";
import { SongListingView } from "logos/commands/components/paginated-views/song-listing-view";

async function handleDisplayPlaybackHistory(client: Client, interaction: Logos.Interaction): Promise<void> {
	const locale = interaction.parameters.show ? interaction.guildLocale : interaction.locale;

	const musicService = client.getMusicService(interaction.guildId);
	if (musicService === undefined) {
		return;
	}

	const isVoiceStateVerified = musicService.verifyVoiceState(interaction, "check");
	if (!isVoiceStateVerified) {
		return;
	}

	const isOccupied = musicService.hasActiveSession;
	if (!isOccupied) {
		const locale = interaction.locale;
		const strings = {
			title: client.localise("music.strings.notPlaying.title", locale)(),
			description: {
				toCheck: client.localise("music.strings.notPlaying.description.toCheck", locale)(),
			},
		};

		await client.warning(interaction, {
			title: strings.title,
			description: strings.description.toCheck,
		});

		return;
	}

	const strings = {
		title: client.localise("music.options.history.strings.playbackHistory", locale)(),
	};

	const view = new SongListingView(client, {
		interaction,
		title: `${constants.emojis.music.list} ${strings.title}`,
		listings: musicService.session.listings.history.listings.toReversed(),
	});

	const refreshView = async () => view.refresh();
	const closeView = async () => view.close();

	musicService.session.events.on("queueUpdate", refreshView);
	musicService.session.events.on("stop", closeView);

	setTimeout(() => {
		musicService.session.events.off("queueUpdate", refreshView);
		musicService.session.events.off("stop", closeView);
	}, constants.INTERACTION_TOKEN_EXPIRY);

	await view.open();
}

export { handleDisplayPlaybackHistory };
