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

	const isOccupied = musicService.isOccupied;
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

	const events = musicService.events;
	if (events === undefined) {
		return;
	}

	const strings = {
		title: client.localise("music.options.history.strings.playbackHistory", locale)(),
	};

	const view = new SongListingView(client, {
		interaction,
		title: `${constants.emojis.music.list} ${strings.title}`,
		listings: structuredClone(musicService.session.history).reverse(),
	});

	const refreshView = async () => view.refresh();
	const closeView = async () => view.close();

	events.on("queueUpdate", refreshView);
	events.on("stop", closeView);

	setTimeout(() => {
		events.off("queueUpdate", refreshView);
		events.off("stop", closeView);
	}, constants.INTERACTION_TOKEN_EXPIRY);

	await view.open();
}

export { handleDisplayPlaybackHistory };
