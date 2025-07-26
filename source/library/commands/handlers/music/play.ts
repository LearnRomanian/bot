import type { Client } from "rost/client";
import resolvers from "rost/commands/resolvers";
import type { SongListingResolver } from "rost/commands/resolvers/resolver";
import { AudioStream, SongListing } from "rost/services/music";

async function handleRequestStreamPlayback(
	client: Client,
	interaction: Rost.Interaction<any, { url: string }>,
): Promise<void> {
	const strings = constants.contexts.stream({ localise: client.localise, locale: interaction.locale });
	const listing: SongListing = new SongListing({
		queueable: new AudioStream({ title: strings.stream, url: interaction.parameters.url }),
		userId: interaction.user.id,
	});

	await handleRequestPlayback(client, interaction, listing);
}

async function handleRequestYouTubePlayback(
	client: Client,
	interaction: Rost.Interaction<any, { query: string }>,
): Promise<void> {
	await handleRequestQueryPlayback(client, interaction, resolvers.youtube);
}

async function handleRequestQueryPlayback(
	client: Client,
	interaction: Rost.Interaction<any, { query: string }>,
	resolveToSongListing: SongListingResolver,
): Promise<void> {
	const musicService = client.services.local("music", { guildId: interaction.guildId });
	if (!(musicService.canManagePlayback(interaction) && musicService.canRequestPlayback(interaction))) {
		return;
	}

	const listing = await resolveToSongListing(client, interaction, { query: interaction.parameters.query });
	if (listing === undefined) {
		const strings = constants.contexts.songNotFound({
			localise: client.localise,
			locale: interaction.locale,
		});
		client
			.warning(interaction, {
				title: strings.title,
				description: `${strings.description.notFound}\n\n${strings.description.tryDifferentQuery}`,
			})
			.ignore();

		return;
	}

	client.acknowledge(interaction).ignore();

	await handleRequestPlayback(client, interaction, listing);
}

async function handleRequestPlayback(
	client: Client,
	interaction: Rost.Interaction,
	listing: SongListing,
): Promise<void> {
	const guild = client.entities.guilds.get(interaction.guildId);
	if (guild === undefined) {
		return;
	}

	const musicService = client.services.local("music", { guildId: interaction.guildId });
	if (!(musicService.canManagePlayback(interaction) && musicService.canRequestPlayback(interaction))) {
		return;
	}

	const voiceState = guild.voiceStates.get(interaction.user.id);
	const channelId = voiceState?.channelId;
	if (channelId === undefined) {
		return;
	}

	await musicService.receiveListing(listing, { channelId });
}

export { handleRequestYouTubePlayback, handleRequestStreamPlayback };
