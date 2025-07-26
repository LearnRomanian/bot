import { EventEmitter } from "node:events";
import { mention } from "rost:constants/formatting";
import type pino from "pino";
import type { Client } from "rost/client";
import { Collector } from "rost/collectors";
import type { Guild } from "rost/models/guild";
import { LocalService } from "rost/services/service";
import * as shoukaku from "shoukaku";

type PlaybackActionType = "manage" | "check";

class MusicService extends LocalService {
	readonly #voiceStateUpdates: Collector<"voiceStateUpdate">;
	#session?: MusicSession;

	#managerDisconnects!: (name: string, count: number) => Promise<void>;
	#managerConnectionRestores!: (name: string, reconnected: boolean) => Promise<void>;

	get configuration(): NonNullable<Guild["features"]["music"]> {
		return this.guildDocument.feature("music");
	}

	get hasSession(): boolean {
		return this.#session !== undefined;
	}

	get session(): MusicSession {
		return this.#session!;
	}

	get #isRostAlone(): boolean | undefined {
		const botVoiceState = this.guild.voiceStates.get(this.client.bot.id);
		if (botVoiceState?.channelId === undefined) {
			return undefined;
		}

		const voiceStatesForChannel = this.guild.voiceStates
			.array()
			.filter((voiceState) => voiceState.channelId === botVoiceState.channelId);

		return voiceStatesForChannel.length === 1;
	}

	constructor(client: Client, { guildId }: { guildId: bigint }) {
		super(client, { identifier: "MusicService", guildId });

		this.#voiceStateUpdates = new Collector({ guildId });
	}

	async start(): Promise<void> {
		this.#voiceStateUpdates.onCollect(this.#handleVoiceStateUpdate.bind(this));

		await this.client.registerCollector("voiceStateUpdate", this.#voiceStateUpdates);

		this.#managerDisconnects = this.#handleConnectionLost.bind(this);
		this.#managerConnectionRestores = this.#handleConnectionRestored.bind(this);

		this.client.services.global("lavalink").manager.on("disconnect", this.#managerDisconnects);
		this.client.services.global("lavalink").manager.on("ready", this.#managerConnectionRestores);
	}

	async stop(): Promise<void> {
		await this.#voiceStateUpdates.close();

		this.client.services.global("lavalink").manager.off("disconnect", this.#managerDisconnects);
		this.client.services.global("lavalink").manager.off("ready", this.#managerConnectionRestores);

		await this.destroySession();
	}

	async createSession({ channelId }: { channelId: bigint }): Promise<MusicSession> {
		const player = await this.client.services.global("lavalink").manager.joinVoiceChannel({
			shardId: this.guild.shardId,
			guildId: this.guildIdString,
			channelId: channelId.toString(),
			deaf: true,
		});

		// Shoukaku does not remove the current track by default, which means we have to override
		// these methods and add that functionality ourselves, given that the value of `track` is
		// how we check whether the player is playing something or not.
		const { stopTrack, onPlayerEvent } = player;
		player.stopTrack = async () => {
			await stopTrack.call(player);
			player.track = null;
		};
		player.onPlayerEvent = (json) => {
			onPlayerEvent.call(player, json);
			if (json.type === "TrackEndEvent") {
				player.track = null;
			}
		};

		await player.setGlobalVolume(this.configuration.implicitVolume);

		this.#session = new MusicSession({ client: this.client, service: this, player, channelId });
		this.#session.start();

		return this.#session;
	}

	async destroySession(): Promise<void> {
		await this.#session?.stop();

		this.#session = undefined;
	}

	async receiveListing(listing: SongListing, { channelId }: { channelId: bigint }): Promise<void> {
		if (!this.hasSession) {
			await this.createSession({ channelId });
		}

		await this.session.receiveListing({ listing });
	}

	async #handleVoiceStateUpdate(_: Discord.VoiceState): Promise<void> {
		if (this.#isRostAlone) {
			await this.#handleSessionAbandoned();
		}
	}

	async #handleSessionAbandoned(): Promise<void> {
		const strings = constants.contexts.stopped({
			localise: this.client.localise,
			locale: this.guildLocale,
		});
		await this.client.bot.helpers
			.sendMessage(this.session.channelId, {
				embeds: [
					{
						title: `${constants.emojis.commands.music.stopped} ${strings.title}`,
						description: strings.description,
						color: constants.colours.notice,
					},
				],
			})
			.catch((error) => this.log.warn(error, "Failed to send stopped music message."));

		await this.destroySession();
	}

	async #handleConnectionLost(_: string, __: number): Promise<void> {
		this.client.bot.gateway
			.leaveVoiceChannel(this.guildId)
			.catch((error) => this.log.warn(error, "Failed to leave voice channel."));

		if (!this.hasSession) {
			return;
		}

		if (this.session.isDisconnected) {
			return;
		}

		const strings = constants.contexts.musicHalted({
			localise: this.client.localise,
			locale: this.guildLocale,
		});
		this.client.bot.helpers
			.sendMessage(this.session.channelId, {
				embeds: [
					{
						title: strings.title,
						description: `${strings.description.outage}\n\n${strings.description.noLoss}`,
						color: constants.colours.death,
					},
				],
			})
			.catch((error) => this.log.warn(error, "Failed to send audio halted message."));

		this.session.player.removeAllListeners();
		this.session.isDisconnected = true;
	}

	async #handleConnectionRestored(_: string, __: boolean): Promise<void> {
		if (!this.hasSession) {
			return;
		}

		await this.session.restore();

		const strings = constants.contexts.musicRestored({
			localise: this.client.localise,
			locale: this.guildLocale,
		});
		this.client.bot.helpers
			.sendMessage(this.session.channelId, {
				embeds: [
					{
						title: strings.title,
						description: strings.description,
						color: constants.colours.success,
					},
				],
			})
			.catch((error) => this.log.warn(error, "Failed to send audio restored message."));
	}

	#canPerformAction(interaction: Rost.Interaction, { action }: { action: PlaybackActionType }): boolean {
		if (this.hasSession && this.session.isDisconnected) {
			const strings = constants.contexts.cannotManageDuringOutage({
				localise: this.client.localise,
				locale: this.guildLocale,
			});
			this.client
				.unsupported(interaction, {
					title: strings.title,
					description: `${strings.description.outage}\n\n${strings.description.backUpSoon}`,
				})
				.ignore();

			return false;
		}

		const userChannelId = this.guild.voiceStates.get(interaction.user.id)?.channelId;
		if (userChannelId === undefined) {
			const strings = constants.contexts.notInVc({
				localise: this.client.localise,
				locale: this.guildLocale,
			});
			this.client
				.warning(interaction, {
					title: strings.title,
					description: action === "manage" ? strings.description.toManage : strings.description.toCheck,
				})
				.ignore();

			return false;
		}

		if (this.hasSession && userChannelId !== this.session.channelId) {
			const strings = constants.contexts.botInDifferentVc({
				localise: this.client.localise,
				locale: this.guildLocale,
			});
			this.client.warning(interaction, { title: strings.title, description: strings.description }).ignore();

			return false;
		}

		return true;
	}

	canCheckPlayback(interaction: Rost.Interaction): boolean {
		return this.#canPerformAction(interaction, { action: "check" });
	}

	canManagePlayback(interaction: Rost.Interaction): boolean {
		return this.#canPerformAction(interaction, { action: "manage" });
	}

	canRequestPlayback(interaction: Rost.Interaction): boolean {
		if (!this.hasSession) {
			return true;
		}

		if (this.session.listings.queue.isFull) {
			const strings = constants.contexts.queueFull({
				localise: this.client.localise,
				locale: interaction.locale,
			});
			this.client
				.warning(interaction, {
					title: strings.title,
					description: strings.description,
				})
				.ignore();

			return false;
		}

		return true;
	}
}

class ListingQueue extends EventEmitter {
	readonly #listings: SongListing[];
	readonly #limit: number;
	readonly #discardOnPassedLimit: boolean;

	get listings(): SongListing[] {
		return structuredClone(this.#listings);
	}

	get count(): number {
		return this.#listings.length;
	}

	get isFull(): boolean {
		return this.#listings.length >= this.#limit;
	}

	get isEmpty(): boolean {
		return this.#listings.length === 0;
	}

	constructor({ limit, discardOnPassedLimit }: { limit: number; discardOnPassedLimit: boolean }) {
		super();
		this.#listings = [];
		this.#limit = limit;
		this.#discardOnPassedLimit = discardOnPassedLimit;
	}

	addOld(listing: SongListing): void {
		if (this.isFull) {
			if (!this.#discardOnPassedLimit) {
				return;
			}

			this.#listings.pop();
		}

		this.#listings.unshift(listing);
	}

	addNew(listing: SongListing): void {
		if (this.isFull) {
			if (!this.#discardOnPassedLimit) {
				return;
			}

			this.#listings.shift();
		}

		this.#listings.push(listing);
	}

	removeOldest(): SongListing {
		return this.#listings.shift()!;
	}

	removeNewest(): SongListing {
		return this.#listings.pop()!;
	}

	removeAt(index: number): SongListing | undefined {
		return this.#listings.splice(index, 1)?.at(0);
	}
}

class ListingManager extends EventEmitter {
	readonly history: ListingQueue;
	readonly queue: ListingQueue;

	#current?: SongListing;

	get hasCurrent(): boolean {
		return this.#current !== undefined;
	}

	get current(): SongListing {
		return this.#current!;
	}

	constructor() {
		super();

		this.setMaxListeners(0);

		this.history = new ListingQueue({ limit: constants.MAXIMUM_HISTORY_ENTRIES, discardOnPassedLimit: true });
		this.queue = new ListingQueue({ limit: constants.MAXIMUM_QUEUE_ENTRIES, discardOnPassedLimit: false });
	}

	moveCurrentToHistory(): void {
		this.#current!.queueable.reset();

		this.history.addNew(this.#current!);
		this.#current = undefined;

		this.emit("history");
	}

	moveCurrentToQueue(): void {
		this.#current!.queueable.reset();

		this.queue.addOld(this.#current!);
		this.#current = undefined;

		this.emit("queue");
	}

	takeCurrentFromQueue(): void {
		this.#current = this.queue.removeOldest();

		this.emit("queue");
	}

	moveFromQueueToHistory({ count }: { count: number }): void {
		count = Math.min(Math.max(count, 0), this.queue.count);

		for (const _ of new Array(count).keys()) {
			this.history.addNew(this.queue.removeOldest());
		}

		if (count !== 0) {
			this.emit("queue");
			this.emit("history");
		}
	}

	moveFromHistoryToQueue({ count }: { count: number }): void {
		count = Math.min(Math.max(count, 0), this.history.count);

		for (const _ of new Array(count).keys()) {
			this.queue.addOld(this.history.removeNewest());
		}

		if (count !== 0) {
			this.emit("history");
			this.emit("queue");
		}
	}

	addToQueue(listing: SongListing): void {
		this.queue.addNew(listing);

		this.emit("queue");
	}

	removeFromQueue({ index }: { index: number }): SongListing | undefined {
		const listing = this.queue.removeAt(index);

		this.emit("queue");

		return listing;
	}

	dispose(): void {
		this.removeAllListeners();
	}
}

type QueueableMode = "song-collection" | "playable";

class MusicSession extends EventEmitter {
	readonly log: pino.Logger;
	readonly client: Client;
	readonly service: MusicService;
	readonly player: shoukaku.Player;
	readonly channelId: bigint;
	readonly listings: ListingManager;
	isDisconnected: boolean;

	#trackEnds!: (data: shoukaku.TrackEndEvent) => Promise<void>;
	#trackExceptions!: (data: shoukaku.TrackExceptionEvent) => Promise<void>;

	get hasCurrent(): boolean {
		return this.listings.hasCurrent;
	}

	get current(): SongListing {
		return this.listings.current;
	}

	get queueable(): Queueable {
		return this.current.queueable;
	}

	get playable(): Playable {
		return this.queueable.playable;
	}

	get playingTimeMilliseconds(): number {
		return Date.now() - this.player.position;
	}

	constructor({
		client,
		service,
		player,
		channelId,
	}: { client: Client; service: MusicService; player: shoukaku.Player; channelId: bigint }) {
		super();

		this.setMaxListeners(0);

		this.log = client.log.child({ name: "MusicSession" });
		this.client = client;
		this.service = service;
		this.player = player;
		this.channelId = channelId;
		this.listings = new ListingManager();
		this.isDisconnected = false;
	}

	start(): void {
		this.#trackEnds = this.#handleTrackEnd.bind(this);
		this.#trackExceptions = this.#handleTrackException.bind(this);

		this.player.on("end", this.#trackEnds);
		this.player.on("exception", this.#trackExceptions);
	}

	async stop(): Promise<void> {
		this.player.off("end", this.#trackEnds);
		this.player.off("exception", this.#trackExceptions);

		this.listings.dispose();
		await this.client.services.global("lavalink").manager.leaveVoiceChannel(this.service.guildIdString);
		await this.client.bot.gateway.leaveVoiceChannel(this.service.guildId);
		this.emit("end");
		this.removeAllListeners();
	}

	async #handleTrackEnd(_: shoukaku.TrackEndEvent): Promise<void> {
		await this.advanceQueue();
	}

	async #handleTrackException(event: shoukaku.TrackExceptionEvent): Promise<void> {
		this.playable.isLooping = false;

		this.log.warn(event.exception, "Failed to play track.");

		const strings = constants.contexts.failedToPlay({
			localise: this.client.localise,
			locale: this.service.guildLocale,
		});
		this.client.bot.helpers
			.sendMessage(this.channelId, {
				embeds: [
					{
						title: strings.title,
						description: strings.description({
							title: this.playable.title,
						}),
						color: constants.colours.failure,
					},
				],
			})
			.catch((error) =>
				this.log.warn(
					error,
					`Failed to send track play failure to ${this.client.diagnostics.channel(
						this.channelId,
					)} on ${this.client.diagnostics.guild(this.service.guildId)}.`,
				),
			);
	}

	async receiveListing({ listing }: { listing: SongListing }): Promise<void> {
		this.listings.addToQueue(listing);

		if (this.hasCurrent) {
			const strings = constants.contexts.queued({
				localise: this.client.localise,
				locale: this.service.guildLocale,
			});
			this.client.bot.helpers
				.sendMessage(this.channelId, {
					embeds: [
						{
							title: `${constants.emojis.commands.music.queued} ${strings.title}`,
							description: strings.description({
								title: listing.queueable.title,
								user_mention: mention(listing.userId, { type: "user" }),
							}),
							color: constants.colours.success,
						},
					],
				})
				.catch((error) => this.log.warn(error, "Failed to send music feedback message."));

			return;
		}

		await this.playNext();
	}

	async restore(): Promise<void> {
		this.isDisconnected = false;

		await this.advanceQueue({ replay: true });
	}

	#advanceSongCollection({ queueable }: { queueable: SongCollection }): void {
		if (queueable.playable.isLooping) {
			return;
		}

		if (!queueable.isLastInCollection) {
			queueable.moveBy({ count: 1, direction: "forward" });
			return;
		}

		if (queueable.isLooping) {
			queueable.moveTo({ index: 0 });
			return;
		}

		this.listings.moveCurrentToHistory();
	}

	#advancePlayable(): void {
		this.listings.moveCurrentToHistory();
	}

	async advanceQueue({ replay = false }: { replay?: boolean } = {}): Promise<void> {
		// There could be no current queueable in the case of the current song elapsing, or in the case of
		// it having been removed through some other action, for example during a skip/unskip action.
		//
		// If it is indeed the situation that there is no current queueable, we just ignore it and carry on
		// as normal, attempting to play the next queueable.
		if (!this.hasCurrent) {
			await this.playNext();
			return;
		}

		if (this.playable.isLooping || replay) {
			await this.play({ playable: this.playable });
			return;
		}

		if (this.queueable instanceof SongCollection) {
			this.#advanceSongCollection({ queueable: this.queueable });

			if (!this.hasCurrent) {
				await this.playNext();
				return;
			}

			await this.play({ playable: this.playable });
			return;
		}

		this.#advancePlayable();
		await this.playNext();
	}

	async playNext(): Promise<void> {
		if (this.listings.queue.isEmpty) {
			return;
		}

		this.listings.takeCurrentFromQueue();

		await this.play({ playable: this.playable });
	}

	async play({ playable }: { playable: Playable }): Promise<boolean> {
		const track = await this.#getTrack({ playable });
		if (track === undefined) {
			return false;
		}

		if (this.queueable instanceof AudioStream) {
			this.queueable.title = track.info.title;
		}

		await this.player.playTrack({ track: { encoded: track.encoded } });

		const strings = constants.contexts.nowPlaying({
			localise: this.client.localise,
			locale: this.service.guildLocale,
		});
		this.client.bot.helpers
			.sendMessage(this.channelId, {
				embeds: [
					{
						title: `${this.queueable.emoji} ${strings.title.nowPlaying({
							listing_type: (() => {
								const queueable = this.queueable;
								switch (true) {
									case queueable instanceof Song: {
										return strings.title.song;
									}
									case queueable instanceof AudioStream: {
										return strings.title.stream;
									}
									case queueable instanceof SongCollection: {
										return strings.title.songCollection;
									}
									default:
										return constants.special.missingString;
								}
							})(),
						})}`,
						description: strings.description.nowPlaying({
							song_information:
								this.queueable instanceof SongCollection
									? strings.description.track({
											index: this.queueable.index + 1,
											number: this.queueable.songs.length,
											title: this.queueable.title,
										})
									: "",
							title: playable.title,
							url: playable.url,
							user_mention: mention(this.current.userId, { type: "user" }),
						}),
						color: constants.colours.notice,
					},
				],
			})
			.catch((error) =>
				this.log.warn(
					error,
					`Failed to send now playing message to ${this.client.diagnostics.channel(
						this.channelId,
					)} on ${this.client.diagnostics.guild(this.service.guildId)}.`,
				),
			);

		return true;
	}

	async #getTrack({ playable }: { playable: Playable }): Promise<shoukaku.Track | undefined> {
		const result = await this.player.node.rest.resolve(`ytsearch:${playable.url}`);
		if (result === undefined) {
			return undefined;
		}

		switch (result.loadType) {
			case shoukaku.LoadType.SEARCH: {
				return result.data.at(0)!;
			}
			case shoukaku.LoadType.PLAYLIST:
			case shoukaku.LoadType.TRACK: {
				throw new Error(
					`UnhandledError: Received an unknown track load type '${result}' when searching for track.`,
				);
			}
			case shoukaku.LoadType.ERROR:
			case shoukaku.LoadType.EMPTY: {
				this.playable.reset();

				const strings = constants.contexts.failedToLoadTrack({
					localise: this.client.localise,
					locale: this.service.guildLocale,
				});
				this.client.bot.helpers
					.sendMessage(this.channelId, {
						embeds: [
							{
								title: strings.title,
								description: strings.description({
									title: playable.title,
								}),
								color: constants.colours.failure,
							},
						],
					})
					.catch((error) =>
						this.log.warn(
							error,
							`Failed to send track load failure to ${this.client.diagnostics.channel(
								this.channelId,
							)} on ${this.client.diagnostics.guild(this.service.guildId)}.`,
						),
					);

				return undefined;
			}
		}
	}

	async setPaused(value: boolean): Promise<void> {
		await this.player.setPaused(value);
	}

	async setVolume(volume: number): Promise<void> {
		await this.player.setGlobalVolume(volume);
	}

	setLoop(value: boolean, { mode }: { mode: QueueableMode }): void {
		switch (mode) {
			case "song-collection": {
				this.queueable.isLooping = value;
				break;
			}
			case "playable": {
				this.playable.isLooping = value;
				break;
			}
		}
	}

	#skipSongInSongCollection({
		queueable,
		controls,
	}: { queueable: SongCollection; controls: Partial<PositionControls> }): void {
		if (controls.by !== undefined) {
			queueable.moveBy({ count: controls.by - 1, direction: "forward" });
			return;
		}

		if (controls.to !== undefined) {
			queueable.moveTo({ index: controls.to - 1 });
		}
	}

	#skipSongCollection(): void {
		this.listings.moveCurrentToHistory();
	}

	#skipPlayable({ controls }: { controls: Partial<PositionControls> }): void {
		this.listings.moveCurrentToHistory();

		const count = controls.by ?? controls.to ?? 0;
		const listingsToMoveToHistory = Math.min(count, this.listings.queue.count);
		this.listings.moveFromQueueToHistory({ count: listingsToMoveToHistory });
	}

	async skip({ mode, controls }: { mode: QueueableMode; controls: Partial<PositionControls> }): Promise<void> {
		if (this.queueable instanceof SongCollection) {
			if (mode === "song-collection" || this.queueable.isLastInCollection) {
				this.#skipSongCollection();
			} else {
				this.#skipSongInSongCollection({ queueable: this.queueable, controls });
			}
		} else {
			this.#skipPlayable({ controls });
		}

		await this.player.stopTrack();
	}

	#unskipSongCollection({ queueable }: { queueable: SongCollection }): void {
		queueable.index -= 1;

		this.listings.moveCurrentToQueue();
		this.listings.moveFromHistoryToQueue({ count: 1 });
	}

	#unskipSongInSongCollection({
		queueable,
		controls,
	}: { queueable: SongCollection; controls: Partial<PositionControls> }): void {
		if (controls.by !== undefined) {
			queueable.moveBy({ count: controls.by, direction: "backward" });
			return;
		}

		if (controls.to !== undefined) {
			queueable.moveTo({ index: controls.to - 1 });
			return;
		}

		queueable.moveBy({ count: 1, direction: "backward" });
	}

	#unskipPlayable({ controls }: { controls: Partial<PositionControls> }): void {
		if (this.hasCurrent) {
			this.listings.moveCurrentToQueue();
		}

		const count = controls.by ?? controls.to ?? 1;
		const listingsToMoveToQueue = Math.min(count, this.listings.history.count);
		this.listings.moveFromHistoryToQueue({ count: listingsToMoveToQueue });
	}

	async unskip({ mode, controls }: { mode: QueueableMode; controls: Partial<PositionControls> }): Promise<void> {
		if (this.hasCurrent && this.queueable instanceof SongCollection) {
			if (mode === "song-collection" || this.queueable.isFirstInCollection) {
				this.#unskipSongCollection({ queueable: this.queueable });
			} else {
				this.#unskipSongInSongCollection({ queueable: this.queueable, controls });
			}
		} else {
			this.#unskipPlayable({ controls });
		}

		if (this.player.track !== null) {
			await this.player.stopTrack();
			return;
		}

		await this.advanceQueue();
	}

	#replaySongCollection(): void {
		const queueable = this.queueable;
		if (!(queueable instanceof SongCollection)) {
			return;
		}

		queueable.moveTo({ index: 0 });
	}

	async replay({ mode }: { mode: QueueableMode }): Promise<void> {
		if (mode === "song-collection") {
			this.#replaySongCollection();
		}

		await this.advanceQueue({ replay: true });
	}

	async skipTo({ timestamp }: { timestamp: number }): Promise<void> {
		await this.player.seekTo(timestamp);
	}
}

interface PositionControls {
	readonly by: number;
	readonly to: number;
}

abstract class Queueable {
	title: string;
	readonly url: string;
	readonly emoji: string;
	isLooping: boolean;

	abstract get playable(): Playable;

	constructor({ title, url, emoji }: { title: string; url: string; emoji: string }) {
		this.title = title;
		this.url = url;
		this.emoji = emoji;
		this.isLooping = false;
	}

	reset(): void {
		this.isLooping = false;
	}
}

abstract class Playable extends Queueable {
	get playable(): this {
		return this;
	}
}

/** Represents a musical piece, playable singly by the music controller. */
class Song extends Playable {
	constructor({ title, url }: { title: string; url: string }) {
		super({ title, url, emoji: constants.emojis.commands.music.song });
	}
}

/** Represents a musical piece in stream format. */
class AudioStream extends Playable {
	constructor({ title, url }: { title: string; url: string }) {
		super({ title, url, emoji: constants.emojis.commands.music.stream });
	}
}

/** Special playable unit used as a placeholder. */
class None extends Playable {
	constructor() {
		super({ title: "None", url: "about:blank", emoji: "❓" });
	}
}

type MoveDirection = "forward" | "backward";

/**
 * Represents a collection of {@link Song}s.
 *
 * Collections occupy a single position in a queue whilst containing multiple,
 * playable songs that would each normally occupy a single place of their own
 * in the queue.
 */
class SongCollection extends Queueable {
	/** The songs in this collection. */
	readonly songs: Song[];
	/** The index of the song that is currently playing. */
	index: number;

	get playable(): Playable {
		return this.songs[this.index] ?? new None();
	}

	get isFirstInCollection(): boolean {
		return this.index === 0;
	}

	get isLastInCollection(): boolean {
		return this.index === this.songs.length - 1;
	}

	get #precedingSongCount(): number {
		return this.index;
	}

	get #followingSongCount(): number {
		return this.songs.length - (this.index + 1);
	}

	constructor({ title, url, songs }: { title: string; url: string; songs: Song[] }) {
		super({ title, url, emoji: constants.emojis.commands.music.collection });

		this.songs = songs;
		this.index = 0;
	}

	reset(): void {
		super.reset();

		for (const playable of this.songs) {
			playable.reset();
		}

		this.index = 0;
	}

	moveBy({ count, direction }: { count: number; direction: MoveDirection }): void {
		this.playable.reset();

		switch (direction) {
			case "forward": {
				this.index += Math.min(count, this.#followingSongCount);
				break;
			}
			case "backward": {
				this.index -= Math.min(count, this.#precedingSongCount) + 1;
				break;
			}
		}
	}

	moveTo({ index }: { index: number }): void {
		this.playable.reset();
		this.index = Math.min(Math.max(index, 0), this.songs.length - 1) - 1;
	}
}

/**
 * Represents a playable object in the form of a song or a collection of songs
 * that contains key information about the listing.
 */
class SongListing {
	readonly queueable: Queueable;
	readonly userId: bigint;
	readonly source?: string;

	constructor({ queueable, userId }: { queueable: Queueable; userId: bigint }) {
		this.queueable = queueable;
		this.userId = userId;
	}
}

export { MusicService, Song, SongCollection, AudioStream, SongListing };
