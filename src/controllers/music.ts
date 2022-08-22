import { Player } from 'https://deno.land/x/lavadeno@3.2.2/mod.ts';
import { LoadType } from 'https://deno.land/x/lavalink_types@2.0.6/mod.ts';
import {
	ApplicationCommandFlags,
	Channel,
	editInteractionResponse,
	Guild,
	Interaction,
	InteractionResponseTypes,
	sendInteractionResponse,
	sendMessage,
	VoiceState,
} from '../../deps.ts';
import { Client } from '../client.ts';
import configuration from '../configuration.ts';
import { Controller } from './controller.ts';
import { Song } from '../commands/music/data/song.ts';
import {
	SongListing,
	SongListingContentTypes,
} from '../commands/music/data/song-listing.ts';
import { SongStream } from '../commands/music/data/song-stream.ts';
import { mention, MentionTypes } from '../formatting.ts';

class MusicController extends Controller {
	/** The audio player associated with this controller. */
	private player: Player;

	/** The voice channel music is being played in. */
	private voiceChannel!: Channel;
	/** The text channel associated with the playback. */
	private textChannel!: Channel;

	/** List of songs which have already been played. */
	history: SongListing[] = [];
	/** The current song listing being played. */
	current?: SongListing;
	/** List of song listings due to be played. */
	queue: SongListing[] = [];

	/** The volume at which music is being played. */
	volume = configuration.music.maxima.volume;

	/**
	 * Indicates whether the current song is to be played again once it ends.
	 */
	private isLoop = false;

	private disconnectTimeoutID: number | undefined = undefined;

	private breakPreviousLoop = false;

	/** Constructs a {@link MusicController}. */
	constructor(client: Client, guild: Guild) {
		super(client, guild);

		this.player = this.client.node.createPlayer(BigInt(this.guild.id));
	}

	/** Gets the current song from the current listing. */
	get currentSong(): Song | SongStream | undefined {
		if (!this.current) return undefined;

		if (this.current.content.type === SongListingContentTypes.Collection) {
			return this.current.content.songs[this.current.content.position];
		}

		return this.current.content;
	}

	/** Checks whether the queue holds fewer items than the limit. */
	get canPushToQueue(): boolean {
		return this.queue.length < configuration.music.maxima.songs.queue;
	}

	get isOccupied(): boolean {
		return !!this.player.playingSince;
	}

	/** Indicates whether the controller is paused or not. */
	get isPaused(): boolean {
		return this.player.paused;
	}

	/** Checks the user's voice state, ensuring it is valid for playing music. */
	verifyMemberVoiceState(
		interaction: Interaction,
	): [boolean, VoiceState | undefined] {
		const voiceState = this.guild.voiceStates.get(interaction.member!.id);

		// The user is not in a voice channel.
		if (!voiceState || !voiceState.channelId) {
			sendInteractionResponse(
				this.client.bot,
				interaction.id,
				interaction.token,
				{
					type: InteractionResponseTypes.ChannelMessageWithSource,
					data: {
						flags: ApplicationCommandFlags.Ephemeral,
						embeds: [
							{
								title: 'You are not in a voice channel',
								description:
									'To manipulate music, you must be in a voice channel.',
								color: configuration.interactions.responses.colors.yellow,
							},
						],
					},
				},
			);
			return [false, voiceState];
		}

		if (this.isOccupied && this.voiceChannel.id !== voiceState.channelId) {
			sendInteractionResponse(
				this.client.bot,
				interaction.id,
				interaction.token,
				{
					type: InteractionResponseTypes.ChannelMessageWithSource,
					data: {
						flags: ApplicationCommandFlags.Ephemeral,
						embeds: [{
							title: 'The bot is playing music in another voice channel',
							description:
								'Join the channel the bot is already playing music in, or wait for the bot to free up.',
							color: configuration.interactions.responses.colors.yellow,
						}],
					},
				},
			);
			return [false, voiceState];
		}

		return [true, voiceState];
	}

	/**
	 * Checks if the user can play music by verifying several factors, such as
	 * whether or not the user is in a voice channel, and if they have provided
	 * the correct arguments.
	 *
	 * @param interaction - The command interaction.
	 * @returns A tuple with the first item indicating whether the user can play
	 * music, and the second being the user's voice state.
	 */
	verifyCanPlay(
		interaction: Interaction,
	): [boolean, VoiceState | undefined] {
		const [canPlay, voiceState] = this.verifyMemberVoiceState(
			interaction,
		);

		if (!canPlay) return [canPlay, voiceState];

		// The user cannot add to the queue due to one reason or another.
		if (!this.canPushToQueue) {
			sendInteractionResponse(
				this.client.bot,
				interaction.id,
				interaction.token,
				{
					type: InteractionResponseTypes.ChannelMessageWithSource,
					data: {
						flags: ApplicationCommandFlags.Ephemeral,
						embeds: [{
							title: 'The queue is full',
							description:
								'Try removing a song from the song queue, skip the current song to advance the queue immediately, or wait until the current song stops playing.',
							color: configuration.interactions.responses.colors.yellow,
						}],
					},
				},
			);
			return [false, voiceState];
		}

		return [true, voiceState];
	}

	private moveToHistory(listing: SongListing): void {
		if (this.history.length === configuration.music.maxima.songs.history) {
			this.history.shift();
		}

		if (listing.content.type === SongListingContentTypes.Collection) {
			listing.content.position--;
		}

		this.history.push(listing);
	}

	/**
	 * Taking a listing and the voice and text channels associated with the request to play,
	 * queues the listing, and optionally plays it.
	 */
	play(
		client: Client,
		{ interaction, songListing, channels }: {
			interaction: Interaction | undefined;
			songListing: SongListing;
			channels: { voice: Channel; text: Channel };
		},
	): Promise<unknown> {
		clearTimeout(this.disconnectTimeoutID);

		this.queue.push(songListing);

		// If the player is not connected to a voice channel, or if it is connected
		// to a different voice channel, connect to the new voice channel.
		if (!this.player.connected) {
			this.player.connect(BigInt(channels.voice.id), { deafen: true });

			this.voiceChannel = channels.voice;
			this.textChannel = channels.text;
		}

		const embeds = [{
			title: '👍 Listing queued.',
			description:
				`Your listing, **${songListing.content.title}**, has been added to the queue.`,
			color: configuration.interactions.responses.colors.green,
		}];

		if (this.isOccupied) {
			if (!interaction) {
				return sendMessage(client.bot, this.textChannel.id, { embeds });
			}

			return editInteractionResponse(client.bot, interaction.token, { embeds });
		}

		return this.advanceQueueAndPlay(interaction);
	}

	private async advanceQueueAndPlay(
		interaction?: Interaction,
		isDeferred?: boolean,
	): Promise<unknown> {
		clearTimeout(this.disconnectTimeoutID);

		const wasLooped = this.isLoop;

		if (!this.isLoop) {
			if (
				this.current &&
				this.current.content.type !== SongListingContentTypes.Collection
			) {
				this.moveToHistory(this.current);
				this.current = undefined;
			}

			if (
				this.queue.length !== 0 &&
				(!this.current ||
					this.current.content.type !== SongListingContentTypes.Collection)
			) {
				this.current = this.queue.shift()!;
			}
		}

		if (
			this.current &&
			this.current.content.type === SongListingContentTypes.Collection
		) {
			if (
				this.current.content.position !== this.current.content.songs.length - 1
			) {
				this.current.content.position++;
			} else {
				if (this.isLoop) {
					this.current.content.position = 0;
				} else {
					this.moveToHistory(this.current);
					this.current = undefined;
				}
			}
		}

		if (!this.current) {
			this.disconnectTimeoutID = setTimeout(
				() => this.reset(),
				configuration.music.disconnectTimeout,
			);

			return sendMessage(this.client.bot, this.textChannel.id, {
				embeds: [{
					title: '👏 All done!',
					description: 'Can I go home for today?',
					color: configuration.interactions.responses.colors.blue,
				}],
			});
		}

		const currentSong = this.currentSong!;

		const tracksResponse = await this.player.node.rest.loadTracks(
			currentSong.url,
		);

		if (
			tracksResponse.loadType === LoadType.LoadFailed ||
			tracksResponse.loadType === LoadType.NoMatches
		) {
			const embeds = [{
				title: 'Couldn\'t load track',
				description:
					`The track, **${currentSong.title}**, could not be loaded.`,
				color: configuration.interactions.responses.colors.red,
			}];

			if (!interaction) {
				return sendMessage(this.client.bot, this.textChannel.id, { embeds });
			}

			if (isDeferred) {
				return editInteractionResponse(this.client.bot, interaction.token, {
					embeds,
				});
			}

			return sendInteractionResponse(
				this.client.bot,
				interaction.id,
				interaction.token,
				{
					type: InteractionResponseTypes.ChannelMessageWithSource,
					data: { embeds },
				},
			);
		}

		const track = tracksResponse.tracks[0]!;

		if (this.current?.content.type === SongListingContentTypes.Stream) {
			this.current.content.title = track.info.title;
		}

		this.player.once(
			'trackEnd',
			(_track, _reason) => {
				if (this.breakPreviousLoop) {
					this.breakPreviousLoop = false;
					return;
				}

				this.advanceQueueAndPlay();
			},
		);

		this.player.play(track.track);

		const embeds = [{
			title: `${configuration.music.symbols[this.current.content.type]} ${
				!wasLooped ? 'Playing' : 'Replaying'
			} ${SongListingContentTypes[this.current.content.type]!.toLowerCase()}`,
			description: `${!wasLooped ? 'Now playing' : 'Replaying'} ${
				this.current.content.type !== SongListingContentTypes.Collection
					? ''
					: `track **${
						this.current.content.position + 1
					}/${this.current.content.songs.length}** of **${this.current.content.title}**: `
			} [**${currentSong.title}**](${currentSong.url}) as requested by ${
				mention(this.current.requestedBy, MentionTypes.User)
			}.`,
			color: configuration.interactions.responses.colors.invisible,
		}];

		if (!interaction) {
			return sendMessage(this.client.bot, this.textChannel.id, { embeds });
		}

		if (isDeferred) {
			return editInteractionResponse(this.client.bot, interaction.token, {
				embeds,
			});
		}

		return sendInteractionResponse(
			this.client.bot,
			interaction.id,
			interaction.token,
			{
				type: InteractionResponseTypes.ChannelMessageWithSource,
				data: { embeds },
			},
		);
	}

	skip(
		skipCollection: boolean,
		{ by, to }: { by: number | undefined; to: number | undefined },
	): void {
		if (this.current?.content.type === SongListingContentTypes.Collection) {
			if (
				skipCollection ||
				this.current.content.position === this.current.content.songs.length - 1
			) {
				this.moveToHistory(this.current!);

				this.current = undefined;
			} else {
				if (by) {
					this.current.content.position += by - 1;
				}

				if (to) {
					this.current.content.position = to! - 2;
				}
			}
		}

		const songsToMoveToHistory = Math.min(by ?? to ?? 0, this.queue.length);

		for (let i = 0; i < songsToMoveToHistory; i++) {
			this.moveToHistory(this.queue.shift()!);
		}

		this.player.stop();
	}

	unskip(
		unskipCollection: boolean,
		{ by, to }: { by: number | undefined; to: number | undefined },
	): void {
		if (this.current?.content.type === SongListingContentTypes.Collection) {
			if (
				unskipCollection ||
				this.current.content.position === 0
			) {
				if (this.current) {
					this.queue.unshift(this.current);
				}

				this.queue.unshift(this.history.pop()!);

				this.current = undefined;
			} else {
				if (by) {
					this.current.content.position -= by + 1;
				}

				if (to) {
					this.current.content.position = to! - 2;
				}

				if (!by && !to) {
					this.current.content.position -= 2;
				}
			}
		}

		const songsToMoveToQueue = Math.min(by ?? to ?? 1, this.history.length);

		if (this.current) {
			this.queue.unshift(this.current);

			this.current = undefined;
		}

		for (let i = 0; i < songsToMoveToQueue; i++) {
			this.queue.unshift(this.history.pop()!);
		}

		if (this.player.track) {
			this.player.stop();
		} else {
			this.advanceQueueAndPlay();
		}
	}

	/** Sets the volume of the player. */
	setVolume(volume: number): void {
		this.volume = volume;

		this.player.setVolume(this.volume);
	}

	pause(): void {
		this.player.pause(true);
	}

	unpause(): void {
		this.player.pause(false);
	}

	replay(
		interaction: Interaction,
		replayCollection: boolean,
	): void {
		const previousLoopState = this.isLoop;
		this.isLoop = true;
		this.player.once('trackStart', () => this.isLoop = previousLoopState);

		if (this.current?.content.type === SongListingContentTypes.Collection) {
			if (replayCollection) {
				this.current.content.position = -1;
			} else {
				this.current!.content.position--;
			}
		}

		this.breakPreviousLoop = true;
		this.player.stop();
		this.advanceQueueAndPlay(interaction);
	}

	reset(): void {
		this.history = [];
		this.current = undefined;
		this.queue = [];

		this.isLoop = false;

		this.player.stop();
		this.player.disconnect();

		this.setVolume(configuration.music.maxima.volume);
	}
}

export { MusicController };
