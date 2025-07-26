import { trim } from "rost:constants/formatting";
import type { Client } from "rost/client";
import { InteractionCollector } from "rost/collectors";
import { Song, SongCollection, SongListing } from "rost/services/music";
import * as youtubei from "youtubei";

const youtube = new youtubei.Client();

async function resolveYouTubeSongListings(
	client: Client,
	interaction: Rost.Interaction,
	{ query }: { query: string },
): Promise<SongListing | undefined> {
	if (!constants.patterns.youtubeUrl.test(query)) {
		return search(client, interaction, query);
	}

	const result = await youtube.findOne(query);
	if (result === undefined) {
		return undefined;
	}

	if (result instanceof youtubei.VideoCompact) {
		return getSongListingFromVideo(result, interaction.user.id);
	}

	if (result instanceof youtubei.PlaylistCompact) {
		const playlist = await youtube.getPlaylist(result.id);
		if (playlist === undefined) {
			return undefined;
		}

		return getSongListingFromPlaylist(playlist, interaction.user.id);
	}

	return undefined;
}

async function search(client: Client, interaction: Rost.Interaction, query: string): Promise<SongListing | undefined> {
	const resultsAll = await youtube.search(query, { limit: 20, type: "all", safeSearch: false });
	const results = resultsAll.items.filter((element) => isPlaylist(element) || isVideo(element));
	if (results.length === 0) {
		return undefined;
	}

	const { promise, resolve } = Promise.withResolvers<SongListing | undefined>();

	const selectMenuSelection = new InteractionCollector(client, { only: [interaction.user.id], isSingle: true });

	selectMenuSelection.onInteraction(async (selection) => {
		client.deleteReply(interaction).ignore();

		const indexString = selection.data?.values?.at(0);
		if (indexString === undefined) {
			return resolve(undefined);
		}

		const index = Number(indexString);
		if (!Number.isSafeInteger(index)) {
			return resolve(undefined);
		}

		const result = results.at(index);
		if (result === undefined) {
			return resolve(undefined);
		}

		if (isPlaylist(result)) {
			const playlist = await youtube.getPlaylist(result.id);
			if (playlist === undefined) {
				return resolve(undefined);
			}

			return resolve(getSongListingFromPlaylist(playlist, interaction.user.id));
		}

		return resolve(getSongListingFromVideo(result, interaction.user.id));
	});

	selectMenuSelection.onDone(() => resolve(undefined));

	await client.registerInteractionCollector(selectMenuSelection);

	const options: Discord.SelectOption[] = [];
	for (const [result, index] of results.map<[youtubei.PlaylistCompact | youtubei.VideoCompact, number]>(
		(result, index) => [result, index],
	)) {
		const title = result.title;
		if (title === undefined) {
			continue;
		}

		options.push({
			emoji: {
				name: isVideo(result)
					? constants.emojis.commands.music.song
					: constants.emojis.commands.music.collection,
			},
			label: trim(title, 100),
			value: index.toString(),
		});
	}

	const strings = constants.contexts.selectSong({ localise: client.localise, locale: interaction.locale });
	client
		.notice(interaction, {
			embeds: [
				{
					title: strings.title,
					description: strings.description,
				},
			],
			components: [
				{
					type: Discord.MessageComponentTypes.ActionRow,
					components: [
						{
							type: Discord.MessageComponentTypes.SelectMenu,
							customId: selectMenuSelection.customId,
							minValues: 1,
							maxValues: 1,
							options,
						},
					],
				},
			],
		})
		.ignore();

	return promise;
}

type Result = youtubei.PlaylistCompact | youtubei.VideoCompact | youtubei.BaseChannel;

function isPlaylist(result: Result): result is youtubei.PlaylistCompact {
	return result instanceof youtubei.Playlist;
}

function isVideo(result: Result): result is youtubei.VideoCompact {
	return result instanceof youtubei.VideoCompact;
}

function getSongListingFromPlaylist(
	playlist: youtubei.Playlist | youtubei.MixPlaylist,
	requestedBy: bigint,
): SongListing | undefined {
	let videos: youtubei.VideoCompact[];
	if (playlist instanceof youtubei.Playlist) {
		videos = playlist.videos.items;
	} else {
		videos = playlist.videos;
	}

	const songs: Song[] = [];
	for (const video of videos) {
		songs.push(new Song({ title: video.title, url: constants.links.youtubeVideo(video.id) }));
	}

	return new SongListing({
		queueable: new SongCollection({
			title: playlist.title,
			url: constants.links.youtubePlaylist(playlist.id),
			songs,
		}),
		userId: requestedBy,
	});
}

function getSongListingFromVideo(
	video: youtubei.VideoCompact | youtubei.Video | youtubei.LiveVideo,
	requestedBy: bigint,
): SongListing | undefined {
	return new SongListing({
		queueable: new Song({ title: video.title, url: constants.links.youtubeVideo(video.id) }),
		userId: requestedBy,
	});
}

export { resolveYouTubeSongListings as resolveYouTubeListings };
