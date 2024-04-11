import { EventEmitter } from "node:events";
import { getEmojiBySongListingType } from "logos:constants/emojis";
import { getLocalisationBySongListingType } from "logos:constants/localisations";
import {
	AudioStream,
	Song,
	SongListing,
	isFirstInCollection,
	isLastInCollection,
	isSongCollection,
	isSongStream,
} from "logos:constants/music";
import { mention } from "logos:core/formatting";
import { Client } from "logos/client";
import { Collector } from "logos/collectors";
import { Guild } from "logos/database/guild";
import { LocalService } from "logos/services/service";
import * as shoukaku from "shoukaku";
class MusicService extends LocalService {
	#session: MusicSession | undefined;

	readonly #_voiceStateUpdates: Collector<"voiceStateUpdate">;

	get configuration(): NonNullable<Guild["music"]> {
		return this.guildDocument.music!;
	}

	get channelId(): bigint | undefined {
		return this.#session?.channelId;
	}

	get events(): EventEmitter | undefined {
		return this.#session?.events;
	}

	get isOccupied(): boolean {
		return this.#session !== undefined;
	}

	get playingSince(): number | undefined {
		const position = this.position;
		if (position === undefined) {
			return undefined;
		}

		return Date.now() - position;
	}

	get position(): number | undefined {
		return this.#session?.player.position;
	}

	get length(): number | undefined {
		return this.#session?.player.data.playerOptions.endTime;
	}

	get session(): MusicSession {
		return this.#session!;
	}

	constructor(client: Client, { guildId }: { guildId: bigint }) {
		super(client, { identifier: "MusicService", guildId });

		this.#session = undefined;

		this.#_voiceStateUpdates = new Collector({ guildId });
	}

	async start(): Promise<void> {
		this.#_voiceStateUpdates.onCollect(this.#handleVoiceStateUpdate.bind(this));

		this.client.lavalinkService.manager.on("disconnect", (_, __) => this.handleConnectionLost());
		this.client.lavalinkService.manager.on("ready", (_, __) => this.handleConnectionRestored());
	}

	async stop(): Promise<void> {
		await this.#_voiceStateUpdates.close();

		await this.destroySession();
	}

	async #handleVoiceStateUpdate(_: Discord.VoiceState): Promise<void> {
		const session = this.#session;
		if (session === undefined) {
			return;
		}

		const voiceStates = this.guild.voiceStates
			.array()
			.filter((voiceState) => voiceState.channelId === session.channelId);
		const hasSessionBeenAbandoned = voiceStates.length === 1 && voiceStates.at(0)?.userId === this.client.bot.id;
		if (hasSessionBeenAbandoned) {
			await this.handleSessionAbandoned();
		}
	}

	async handleSessionAbandoned(): Promise<void> {
		const session = this.#session;
		if (session === undefined) {
			return;
		}

		const strings = {
			title: this.client.localise("music.options.stop.strings.stopped.title", this.guildLocale)(),
			description: this.client.localise("music.options.stop.strings.stopped.description", this.guildLocale)(),
		};

		await this.client.bot.helpers
			.sendMessage(session.channelId, {
				embeds: [
					{
						title: `${constants.emojis.music.stopped} ${strings.title}`,
						description: strings.description,
						color: constants.colours.notice,
					},
				],
			})
			.catch(() => this.log.warn("Failed to send stopped music message."));

		await this.destroySession();
	}

	async createSession(channelId: bigint): Promise<MusicSession | undefined> {
		const oldSession = this.#session;

		const player = await this.client.lavalinkService.manager.joinVoiceChannel({
			shardId: this.guild.shardId,
			guildId: this.guildIdString,
			channelId: channelId.toString(),
			deaf: true,
		});

		await player.setGlobalVolume(this.configuration.implicitVolume);

		const session = new MusicSession({ service: this, player, channelId, oldSession });

		this.#session = session;

		return session;
	}

	async destroySession(): Promise<void> {
		const session = this.#session;
		if (session === undefined) {
			return;
		}

		this.#session = undefined;

		session.events.emit("stop");
		await session.player.node.manager.leaveVoiceChannel(this.guildIdString);
		await session.player.destroy();
	}

	handleConnectionLost(): void {
		this.client.bot.gateway
			.leaveVoiceChannel(this.guildId)
			.catch(() => this.log.warn("Failed to leave voice channel."));

		const session = this.#session;
		if (session === undefined) {
			return;
		}

		if (session.flags.isDisconnected) {
			return;
		}

		const guildLocale = this.guildLocale;

		const now = Date.now();

		const strings = {
			title: this.client.localise("music.strings.outage.halted.title", guildLocale)(),
			description: {
				outage: this.client.localise("music.strings.outage.halted.description.outage", guildLocale)(),
				noLoss: this.client.localise("music.strings.outage.halted.description.noLoss", guildLocale)(),
			},
		};

		this.client.bot.rest
			.sendMessage(session.channelId, {
				embeds: [
					{
						title: strings.title,
						description: `${strings.description.outage}\n\n${strings.description.noLoss}`,
						color: constants.colours.death,
					},
				],
			})
			.catch(() => this.log.warn("Failed to send audio halted message."));

		session.player.removeAllListeners();

		session.flags.isDisconnected = true;

		const currentSong = session.currentSong;
		if (currentSong === undefined) {
			return;
		}

		session.restoreAt = session.restoreAt + (now - session.startedAt);
	}

	async handleConnectionRestored(): Promise<void> {
		const oldSession = this.#session;
		if (oldSession === undefined) {
			return;
		}

		if (!oldSession.flags.isDisconnected) {
			return;
		}

		oldSession.flags.isDisconnected = false;

		const currentSong = oldSession.currentSong;
		if (currentSong === undefined) {
			await this.destroySession();
			return;
		}

		await this.destroySession();
		await this.createSession(oldSession.channelId);

		const newSession = this.#session;
		if (newSession === undefined) {
			return;
		}

		// TODO(vxern): Create a method to plug in a new player into an old session.
		// @ts-ignore: For now...
		this.#session = { ...oldSession, player: newSession.player };

		await this.loadSong(currentSong, { paused: oldSession.player.paused, volume: oldSession.player.volume });

		const guildLocale = this.guildLocale;

		const strings = {
			title: this.client.localise("music.strings.outage.restored.title", guildLocale)(),
			description: this.client.localise("music.strings.outage.restored.description", guildLocale)(),
		};

		this.client.bot.rest
			.sendMessage(newSession.channelId, {
				embeds: [
					{
						title: strings.title,
						description: strings.description,
						color: constants.colours.success,
					},
				],
			})
			.catch(() => this.log.warn("Failed to send audio restored message."));
	}

	verifyVoiceState(interaction: Logos.Interaction, action: "manage" | "check"): boolean {
		const locale = interaction.locale;

		const session = this.#session;
		if (session === undefined) {
			return false;
		}

		if (session?.flags.isDisconnected) {
			const strings = {
				title: this.client.localise("music.strings.outage.cannotManage.title", locale)(),
				description: {
					outage: this.client.localise("music.strings.outage.cannotManage.description.outage", locale)(),
					backUpSoon: this.client.localise("music.strings.outage.cannotManage.description.backUpSoon", locale)(),
				},
			};

			this.client.unsupported(interaction, {
				title: strings.title,
				description: `${strings.description.outage}\n\n${strings.description.backUpSoon}`,
			});

			return false;
		}

		const voiceState = this.guild.voiceStates.get(interaction.user.id);
		const userChannelId = voiceState?.channelId;

		if (voiceState === undefined || userChannelId === undefined) {
			const strings = {
				title: this.client.localise("music.strings.notInVc.title", locale)(),
				description: {
					toManage: this.client.localise("music.strings.notInVc.description.toManage", locale)(),
					toCheck: this.client.localise("music.strings.notInVc.description.toCheck", locale)(),
				},
			};

			this.client.warning(interaction, {
				title: strings.title,
				description: action === "manage" ? strings.description.toManage : strings.description.toCheck,
			});

			return false;
		}

		const [isOccupied, channelId] = [this.isOccupied, this.channelId];
		if (isOccupied !== undefined && isOccupied && voiceState.channelId !== channelId) {
			const strings = {
				title: this.client.localise("music.options.play.strings.inDifferentVc.title", locale)(),
				description: this.client.localise("music.options.play.strings.inDifferentVc.description", locale)(),
			};

			this.client.warning(interaction, {
				title: strings.title,
				description: strings.description,
			});

			return false;
		}

		return true;
	}

	verifyCanRequestPlayback(interaction: Logos.Interaction): boolean {
		const locale = interaction.locale;

		const isVoiceStateVerified = this.verifyVoiceState(interaction, "manage");
		if (!isVoiceStateVerified) {
			return false;
		}

		if (this.session.listings.queue.isFull) {
			const strings = {
				title: this.client.localise("music.options.play.strings.queueFull.title", locale)(),
				description: this.client.localise("music.options.play.strings.queueFull.description", locale)(),
			};

			this.client.warning(interaction, {
				title: strings.title,
				description: strings.description,
			});

			return false;
		}

		return true;
	}

	verifyCanManagePlayback(interaction: Logos.Interaction): boolean {
		const isVoiceStateVerified = this.verifyVoiceState(interaction, "manage");
		if (!isVoiceStateVerified) {
			return false;
		}

		const current = this.#session?.listings.current;
		if (current === undefined) {
			return true;
		}

		return true;
	}

	async receiveNewListing(listing: SongListing, channelId: bigint): Promise<void> {
		const session = this.#session ?? (await this.createSession(channelId));
		if (session === undefined) {
			return;
		}

		session.receiveListing({ listing });

		const guildLocale = this.guildLocale;

		if (session.listings.current !== undefined) {
			const strings = {
				title: this.client.localise("music.options.play.strings.queued.title", guildLocale)(),
				description: this.client.localise(
					"music.options.play.strings.queued.description.public",
					guildLocale,
				)({
					title: listing.content.title,
					user_mention: mention(listing.requestedBy, { type: "user" }),
				}),
			};

			await this.client.bot.rest
				.sendMessage(session.channelId, {
					embeds: [
						{
							title: `${constants.emojis.music.queued} ${strings.title}`,
							description: strings.description,
							color: constants.colours.success,
						},
					],
				})
				.catch(() => this.log.warn("Failed to send music feedback message."));

			return;
		}

		await session.advanceQueueAndPlay();
	}

	async loadSong(
		song: Song | AudioStream,
		restore?: { paused: boolean; volume: number },
	): Promise<boolean | undefined> {
		const session = this.#session;
		if (session === undefined) {
			return undefined;
		}

		const result = await session.player.node.rest.resolve(`ytsearch:${song.url}`);

		if (result === undefined || result.loadType === "error" || result.loadType === "empty") {
			session.flags.loop.song = false;

			const guildLocale = this.guildLocale;
			const strings = {
				title: this.client.localise("music.options.play.strings.failedToLoad.title", guildLocale)(),
				description: this.client.localise(
					"music.options.play.strings.failedToLoad.description",
					guildLocale,
				)({
					title: song.title,
				}),
			};

			this.client.bot.rest
				.sendMessage(session.channelId, {
					embeds: [
						{
							title: strings.title,
							description: strings.description,
							color: constants.colours.failure,
						},
					],
				})
				.catch(() =>
					this.log.warn(
						`Failed to send track load failure to ${this.client.diagnostics.channel(
							session.channelId,
						)} on ${this.client.diagnostics.guild(this.guildId)}.`,
					),
				);

			await session.advanceQueueAndPlay();

			return false;
		}

		let track: shoukaku.Track | undefined;
		if (result.loadType === "search") {
			track = result.data.at(0);
		}
		if (track === undefined) {
			return false;
		}

		if (
			session.listings.current !== undefined &&
			session.listings.current.content !== undefined &&
			isSongStream(session.listings.current.content)
		) {
			session.listings.current.content.title = track.info.title;
		}

		session.player.once("exception", async (reason) => {
			const session = this.#session;
			if (session === undefined) {
				return;
			}

			session.flags.loop.song = false;

			this.log.warn(`Failed to play track: ${reason.exception}`);

			const guildLocale = this.guildLocale;
			const strings = {
				title: this.client.localise("music.options.play.strings.failedToPlay.title", guildLocale)(),
				description: this.client.localise(
					"music.options.play.strings.failedToPlay.description",
					guildLocale,
				)({
					title: song.title,
				}),
			};

			this.client.bot.rest
				.sendMessage(session.channelId, {
					embeds: [
						{
							title: strings.title,
							description: strings.description,
							color: constants.colours.failure,
						},
					],
				})
				.catch(() =>
					this.log.warn(
						`Failed to send track play failure to ${this.client.diagnostics.channel(
							session.channelId,
						)} on ${this.client.diagnostics.guild(this.guildId)}.`,
					),
				);
		});

		session.player.once("end", async () => {
			const session = this.#session;
			if (session === undefined) {
				return;
			}

			session.player.removeAllListeners("trackException");

			if (session.flags.isDestroyed) {
				return;
			}

			if (session.flags.breakLoop) {
				session.flags.breakLoop = false;
				return;
			}

			session.restoreAt = 0;

			await session.advanceQueueAndPlay();
		});

		session.player.once("start", async () => {
			const now = Date.now();
			session.startedAt = now;

			if (session.restoreAt !== 0) {
				await session.player.seekTo(session.restoreAt);
			}

			if (restore !== undefined) {
				await session.player.setPaused(restore.paused);
			}
		});

		if (restore !== undefined) {
			await session.player.setGlobalVolume(restore.volume);
			await session.player.playTrack({ track: track.encoded });
			return;
		}

		await session.player.playTrack({ track: track.encoded });

		const emoji = getEmojiBySongListingType(session.listings.current?.content.type ?? song.type);

		const guildLocale = this.guildLocale;
		const strings = {
			title: this.client.localise(
				"music.options.play.strings.nowPlaying.title.nowPlaying",
				guildLocale,
			)({
				listing_type: this.client.localise(
					getLocalisationBySongListingType(session.listings.current?.content.type ?? song.type),
					guildLocale,
				)(),
			}),
			description: {
				nowPlaying: this.client.localise("music.options.play.strings.nowPlaying.description.nowPlaying", guildLocale),
				track:
					session.listings.current !== undefined &&
					session.listings.current.content !== undefined &&
					isSongCollection(session.listings.current.content)
						? this.client.localise(
								"music.options.play.strings.nowPlaying.description.track",
								guildLocale,
						  )({
								index: session.listings.current.content.position + 1,
								number: session.listings.current.content.songs.length,
								title: session.listings.current.content.title,
						  })
						: "",
			},
		};

		if (session.listings.current !== undefined) {
			this.client.bot.rest
				.sendMessage(session.channelId, {
					embeds: [
						{
							title: `${emoji} ${strings.title}`,
							description: strings.description.nowPlaying({
								song_information: strings.description.track,
								title: song.title,
								url: song.url,
								user_mention: mention(session.listings.current.requestedBy, { type: "user" }),
							}),
							color: constants.colours.notice,
						},
					],
				})
				.catch(() =>
					this.log.warn(
						`Failed to send now playing message to ${this.client.diagnostics.channel(
							session.channelId,
						)} on ${this.client.diagnostics.guild(this.guildId)}.`,
					),
				);
		}

		return true;
	}
}

class ListingQueue {
	readonly #_listings: SongListing[];
	readonly #_limit: number;
	readonly #_discardOnPassedLimit: boolean;

	get listings(): SongListing[] {
		return Object.freeze(structuredClone(this.#_listings)) as SongListing[];
	}

	get count(): number {
		return this.#_listings.length;
	}

	get isFull(): boolean {
		return this.#_listings.length >= this.#_limit;
	}

	get isEmpty(): boolean {
		return this.#_listings.length === 0;
	}

	constructor({ limit, discardOnPassedLimit }: { limit: number; discardOnPassedLimit: boolean }) {
		this.#_listings = [];
		this.#_limit = limit;
		this.#_discardOnPassedLimit = discardOnPassedLimit;
	}

	addOld(listing: SongListing): void {
		if (this.isFull) {
			if (!this.#_discardOnPassedLimit) {
				// TODO(vxern): Handle refusal to add to queue.
				return;
			}

			this.#_listings.pop();
		}

		this.#_listings.unshift(listing);

		// REMINDER(vxern): Emit an event.
	}

	addNew(listing: SongListing): void {
		if (this.isFull) {
			if (!this.#_discardOnPassedLimit) {
				// TODO(vxern): Handle refusal to add to queue.
				return;
			}

			this.#_listings.shift();
		}

		this.#_listings.push(listing);

		// REMINDER(vxern): Emit an event.
	}

	removeOldest(): SongListing {
		// REMINDER(vxern): Emit an event.

		return this.#_listings.shift()!;
	}

	removeNewest(): SongListing {
		// REMINDER(vxern): Emit an event.

		return this.#_listings.pop()!;
	}

	removeAt(index: number): SongListing | undefined {
		const listing = this.#_listings.splice(index, 1)?.at(0);

		// REMINDER(vxern): Emit an event.

		return listing;
	}
}

class ListingManager {
	readonly history: ListingQueue;
	readonly queue: ListingQueue;
	current?: SongListing;

	constructor() {
		this.history = new ListingQueue({ limit: constants.MAXIMUM_HISTORY_ENTRIES, discardOnPassedLimit: true });
		this.queue = new ListingQueue({ limit: constants.MAXIMUM_QUEUE_ENTRIES, discardOnPassedLimit: false });
	}

	moveCurrentToHistory(): void {
		// TODO(vxern): This is bad, and it shouldn't be necessary here.
		const current = this.current!;
		// Adjust the position for being incremented automatically when played next time.
		if (isSongCollection(current.content)) {
			current.content.position -= 1;
		}

		this.history.addNew(current);
		this.current = undefined;
	}

	moveCurrentToQueue(): void {
		this.queue.addOld(this.current!);
		this.current = undefined;
	}

	takeCurrentFromQueue(): void {
		this.current = this.queue.removeOldest();
	}

	moveFromQueueToHistory({ count }: { count: number }): void {
		for (const _ of Array(count).keys()) {
			this.history.addNew(this.queue.removeOldest());
		}

		// REMINDER(vxern): Emit event.
	}

	moveFromHistoryToQueue({ count }: { count: number }): void {
		for (const _ of Array(count).keys()) {
			this.queue.addOld(this.history.removeNewest());
		}

		// REMINDER(vxern): Emit event.
	}
}

// TODO(vxern): Set up listeners to automatically respond to queue events.
type ListingMode = "single" | "collection";
class MusicSession {
	readonly events: EventEmitter;
	readonly service: MusicService;
	readonly player: shoukaku.Player;
	readonly channelId: bigint;
	readonly listings: ListingManager;
	readonly flags: {
		isDisconnected: boolean;
		isDestroyed: boolean;
		loop: {
			song: boolean;
			collection: boolean;
		};
		breakLoop: boolean;
	};

	startedAt: number;
	restoreAt: number;

	get isPaused(): boolean {
		return this.player.paused;
	}

	get volume(): number {
		return this.player.volume;
	}

	// TODO(vxern): Refactor.
	get currentSong(): Song | AudioStream | undefined {
		const current = this.listings.current;
		if (current === undefined) {
			return undefined;
		}

		if (isSongCollection(current.content)) {
			return current.content.songs[current.content.position];
		}

		return current.content;
	}

	constructor({
		service,
		player,
		channelId,
		oldSession,
	}: { service: MusicService; player: shoukaku.Player; channelId: bigint; oldSession?: MusicSession }) {
		this.events = oldSession?.events ?? new EventEmitter().setMaxListeners(0);
		this.service = service;
		this.player = player;
		this.channelId = channelId;
		this.listings = new ListingManager();
		this.startedAt = 0;
		this.restoreAt = 0;
		this.flags = {
			isDisconnected: false,
			isDestroyed: false,
			loop: { song: false, collection: false },
			breakLoop: false,
		};
	}

	receiveListing({ listing }: { listing: SongListing }): void {
		this.listings.queue.addNew(listing);
	}

	// TODO(vxern): Refactor this.
	async advanceQueueAndPlay(): Promise<void> {
		if (!this.flags.loop.song) {
			if (this.listings.current !== undefined && !isSongCollection(this.listings.current.content)) {
				this.listings.moveCurrentToHistory();
			}

			if (
				!this.listings.queue.isEmpty &&
				(this.listings.current === undefined || !isSongCollection(this.listings.current.content))
			) {
				this.listings.takeCurrentFromQueue();
			}
		}

		if (this.listings.current?.content !== undefined && isSongCollection(this.listings.current.content)) {
			if (isLastInCollection(this.listings.current.content)) {
				if (this.flags.loop.collection) {
					this.listings.current.content.position = 0;
				} else {
					this.listings.moveCurrentToHistory();
					// REMINDER(vxern): Check whether the movement from queue to current here was necessary, or an issue.
					return this.advanceQueueAndPlay();
				}
			} else {
				if (this.flags.loop.song) {
					this.listings.current.content.position -= 1;
				}

				this.listings.current.content.position += 1;
			}
		}

		if (this.listings.current === undefined) {
			return;
		}

		const currentSong = this.currentSong;
		if (currentSong === undefined) {
			return;
		}

		await this.service.loadSong(currentSong);
	}

	async setPaused(value: boolean): Promise<void> {
		await this.player.setPaused(value);
	}

	async setVolume(volume: number): Promise<void> {
		await this.player.setGlobalVolume(volume);
	}

	setLoop(value: boolean, { mode }: { mode: ListingMode }): void {
		switch (mode) {
			case "single": {
				this.flags.loop.song = value;
				break;
			}
			case "collection": {
				this.flags.loop.collection = value;
				break;
			}
		}
	}

	// TODO(vxern): Refactor this.
	async skip(collection: boolean, { by, to }: Partial<PositionControls>): Promise<void> {
		if (this.listings.current?.content !== undefined && isSongCollection(this.listings.current.content)) {
			if (collection || isLastInCollection(this.listings.current.content)) {
				this.flags.loop.collection = false;
				this.listings.moveCurrentToHistory();
			} else {
				this.flags.loop.song = false;

				if (by !== undefined) {
					this.listings.current.content.position += by - 1;
				}

				if (to !== undefined) {
					this.listings.current.content.position = to - 2;
				}
			}
		} else {
			const listingsToMoveToHistory = Math.min(by ?? to ?? 0, this.listings.queue.count);

			if (this.listings.current !== undefined) {
				this.listings.moveCurrentToHistory();
			}

			this.listings.moveFromQueueToHistory({ count: listingsToMoveToHistory });

			if (listingsToMoveToHistory !== 0) {
				this.flags.loop.song = false;
			}
		}

		await this.player.stopTrack();
	}

	// TODO(vxern): Refactor this.
	async unskip(collection: boolean, { by, to }: Partial<PositionControls>): Promise<void> {
		if (this.listings.current?.content !== undefined && isSongCollection(this.listings.current.content)) {
			if (collection || isFirstInCollection(this.listings.current.content)) {
				this.flags.loop.collection = false;

				this.listings.current.content.position -= 1;

				this.listings.queue.addOld(this.listings.current);
				this.listings.queue.addOld(this.listings.history.removeNewest());
				this.listings.current = undefined;
			} else {
				this.flags.loop.song = false;

				if (by !== undefined) {
					this.listings.current.content.position -= by + 1;
				}

				if (to !== undefined) {
					this.listings.current.content.position = to - 2;
				}

				if (by === undefined && to === undefined) {
					this.listings.current.content.position -= 2;
				}
			}
		} else {
			const listingsToMoveToQueue = Math.min(by ?? to ?? 1, this.listings.history.count);

			if (this.listings.current !== undefined) {
				this.listings.moveCurrentToQueue();
			}

			this.listings.moveFromHistoryToQueue({ count: listingsToMoveToQueue });
		}

		if (this.player.track !== undefined) {
			await this.player.stopTrack();
		} else {
			await this.advanceQueueAndPlay();
		}
	}

	// TODO(vxern): Refactor this.
	async replay(collection: boolean): Promise<void> {
		if (collection) {
			const previousLoopState = this.flags.loop.collection;
			this.flags.loop.collection = true;
			this.player.once("start", () => {
				this.flags.loop.collection = previousLoopState;
			});
		} else {
			const previousLoopState = this.flags.loop.song;
			this.flags.loop.song = true;
			this.player.once("start", () => {
				this.flags.loop.song = previousLoopState;
			});
		}

		if (
			this.listings.current?.content !== undefined &&
			isSongCollection(this.listings.current.content)
		) {
			if (collection) {
				this.listings.current.content.position = -1;
			}
		}

		this.flags.breakLoop = true;
		this.restoreAt = 0;
		await this.player.stopTrack();

		await this.advanceQueueAndPlay();
	}

	// TODO(vxern): Refactor this.
	async skipTo({ timestamp }: { timestamp: number }): Promise<void> {
		this.restoreAt = timestamp;
		await this.player.seekTo(timestamp);
	}
}

interface PositionControls {
	readonly by: number;
	readonly to: number;
}

export { MusicService };
