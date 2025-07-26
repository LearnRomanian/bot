import { mention } from "rost:constants/formatting";
import type { Client } from "rost/client";
import { RemoveSongListingView } from "rost/commands/components/paginated-views/remove-song-listing-view";

async function handleRemoveSongListing(client: Client, interaction: Rost.Interaction): Promise<void> {
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

	const view = new RemoveSongListingView(client, {
		interaction,
		listings: musicService.session.listings.queue.listings,
	});

	view.onRemove(async (buttonPress) => {
		const indexString = buttonPress.data?.values?.at(0);
		if (indexString === undefined) {
			return;
		}

		const index = Number(indexString);
		if (!Number.isSafeInteger(index)) {
			return;
		}

		const listing = musicService.session.listings.removeFromQueue({ index });
		if (listing === undefined) {
			const strings = constants.contexts.failedToRemoveSong({
				localise: client.localise,
				locale: interaction.locale,
			});
			client.failed(buttonPress, { title: strings.title, description: strings.description }).ignore();

			return;
		}

		const strings = constants.contexts.removedSong({ localise: client.localise, locale: interaction.guildLocale });
		client
			.success(
				buttonPress,
				{
					title: `${constants.emojis.commands.music.removed} ${strings.title}`,
					description: strings.description({
						title: listing.queueable.title,
						user_mention: mention(buttonPress.user.id, { type: "user" }),
					}),
				},
				{ visible: true },
			)
			.ignore();
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

export { handleRemoveSongListing };
