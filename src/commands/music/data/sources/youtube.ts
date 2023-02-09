import {
	ApplicationCommandFlags,
	Bot,
	deleteOriginalInteractionResponse,
	Interaction,
	InteractionResponseTypes,
	InteractionTypes,
	MessageComponentTypes,
	SelectOption,
	sendInteractionResponse,
} from 'discordeno';
import { Channel, Playlist, Video, YouTube } from 'youtube';
import { Commands, localise } from 'logos/assets/localisations/mod.ts';
import { ListingResolver } from 'logos/src/commands/music/data/sources/sources.ts';
import { SongListing, SongListingContentTypes } from 'logos/src/commands/music/data/types.ts';
import { Client } from 'logos/src/client.ts';
import { createInteractionCollector } from 'logos/src/interactions.ts';
import constants from 'logos/constants.ts';
import { trim } from 'logos/formatting.ts';

const urlExpression = new RegExp(
	/^(?:https?:)?(?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch|v|embed)(?:\.php)?(?:\?.*v=|\/))([a-zA-Z0-9\_-]{7,15})(?:[\?&][a-zA-Z0-9\_-]+=[a-zA-Z0-9\_-]+)*$/,
);

const resolver: ListingResolver = async ([client, bot], interaction, query) => {
	const urlExpressionExecuted = urlExpression.exec(query) ?? undefined;
	if (urlExpressionExecuted === undefined) {
		return search([client, bot], interaction, query);
	}

	sendInteractionResponse(bot, interaction.id, interaction.token, {
		type: InteractionResponseTypes.DeferredChannelMessageWithSource,
	});

	deleteOriginalInteractionResponse(bot, interaction.token);

	const url = urlExpressionExecuted.at(0)!;
	if (url.includes('list=')) {
		const playlist = await YouTube.getPlaylist(query);
		return fromYouTubePlaylist(playlist, interaction.user.id);
	}

	const video = await YouTube.getVideo(query);
	return fromYouTubeVideo(video, interaction.user.id);
};

async function search(
	[client, bot]: [Client, Bot],
	interaction: Interaction,
	query: string,
): Promise<SongListing | undefined> {
	const items = await YouTube.search(query, { limit: 20, type: 'all', safeSearch: false })
		.then(
			(item) => item.filter((element) => isPlaylist(element) || isVideo(element)),
		) as Array<Video | Playlist>;
	if (items.length === 0) return undefined;

	return new Promise<SongListing | undefined>((resolve) => {
		const customId = createInteractionCollector(
			[client, bot],
			{
				type: InteractionTypes.MessageComponent,
				userId: interaction.user.id,
				limit: 1,
				onCollect: async (bot, selection) => {
					sendInteractionResponse(bot, selection.id, selection.token, {
						type: InteractionResponseTypes.DeferredUpdateMessage,
					});

					const indexString = selection.data?.values?.at(0) as string | undefined;
					if (indexString === undefined) return resolve(undefined);

					const index = Number(indexString);
					if (isNaN(index)) return resolve(undefined);

					const item = items.at(index)!;
					if (isPlaylist(item)) {
						const playlist = await YouTube.getPlaylist(item.url!);
						return resolve(fromYouTubePlaylist(playlist, interaction.user.id));
					}

					return resolve(fromYouTubeVideo(item, interaction.user.id));
				},
			},
		);

		sendInteractionResponse(bot, interaction.id, interaction.token, {
			type: InteractionResponseTypes.ChannelMessageWithSource,
			data: {
				flags: ApplicationCommandFlags.Ephemeral,
				embeds: [{
					title: localise(Commands.music.options.play.strings.selectSong.header, interaction.locale),
					description: localise(Commands.music.options.play.strings.selectSong.body, interaction.locale),
					color: constants.colors.blue,
				}],
				components: [{
					type: MessageComponentTypes.ActionRow,
					components: [{
						type: MessageComponentTypes.SelectMenu,
						customId: customId,
						minValues: 1,
						maxValues: 1,
						options: items.map<SelectOption>(
							(result, index) => ({
								emoji: {
									name: isVideo(result) ? constants.symbols.music.song : constants.symbols.music.collection,
								},
								label: trim(result.title!, 100),
								value: index.toString(),
							}),
						),
					}],
				}],
			},
		});
	});
}

type YouTubeItem = Playlist | Video | Channel;

function isPlaylist(item: YouTubeItem): item is Playlist {
	return item.type === 'playlist';
}

function isVideo(item: YouTubeItem): item is Video {
	return item.type === 'video';
}

/**
 * Creates a song listing from a YouTube video.
 */
function fromYouTubeVideo(
	video: Video,
	requestedBy: bigint,
): SongListing | undefined {
	if (video.id === undefined) return undefined;

	return {
		source: 'YouTube',
		requestedBy,
		managerIds: [],
		content: {
			type: SongListingContentTypes.Song,
			title: video.title!,
			url: video.url!,
			duration: video.duration,
		},
	};
}

/**
 * Creates a song listing from a YouTube playlist.
 */
function fromYouTubePlaylist(playlist: Playlist, requestedBy: bigint): SongListing | undefined {
	if (playlist.id === undefined) return undefined;

	return {
		source: 'YouTube',
		requestedBy,
		managerIds: [],
		content: {
			type: SongListingContentTypes.Collection,
			title: playlist.title!,
			songs: playlist.videos.map((video) => ({
				type: SongListingContentTypes.Song,
				title: video.title!,
				url: video.url!,
				duration: video.duration,
			})),
			position: -1,
		},
	};
}

export default resolver;
