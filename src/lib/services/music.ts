import { EventEmitter } from "node:events";
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

	// TODO(vxern): Remove this.
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

		const currentSong = oldSession.playable;

		await this.destroySession();
		await this.createSession(oldSession.channelId);

		const newSession = this.#session;
		if (newSession === undefined) {
			return;
		}

		// TODO(vxern): Create a method to plug in a new player into an old session.
		// @ts-ignore: For now...
		this.#session = { ...oldSession, player: newSession.player };

		await this.session.loadSong(currentSong, { paused: oldSession.player.paused, volume: oldSession.player.volume });

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

		const current = this.#session?.current;
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

		// TODO(vxern): Convert to an 'is playing' check.
		if (session.current !== undefined) {
			const strings = {
				title: this.client.localise("music.options.play.strings.queued.title", guildLocale)(),
				description: this.client.localise(
					"music.options.play.strings.queued.description.public",
					guildLocale,
				)({
					title: listing.queueable.playable.title,
					user_mention: mention(listing.userId, { type: "user" }),
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
}

class ListingQueue {
	readonly #_listings: SongListing[];
	readonly #_limit: number;
	readonly #_discardOnPassedLimit: boolean;

	get listings(): SongListing[] {
		return structuredClone(this.#_listings);
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

	#current?: SongListing;

	get current(): SongListing {
		return this.#current!;
	}

	constructor() {
		this.history = new ListingQueue({ limit: constants.MAXIMUM_HISTORY_ENTRIES, discardOnPassedLimit: true });
		this.queue = new ListingQueue({ limit: constants.MAXIMUM_QUEUE_ENTRIES, discardOnPassedLimit: false });
	}

	moveCurrentToHistory(): void {
		// TODO(vxern): This is bad, and it shouldn't be necessary here.
		// Adjust the position for being incremented automatically when played next time.
		if (this.current.queueable instanceof SongCollection) {
			this.current.queueable.position -= 1;
		}

		this.history.addNew(this.#current!);
		this.#current = undefined;
	}

	moveCurrentToQueue(): void {
		this.queue.addOld(this.#current!);
		this.#current = undefined;
	}

	takeCurrentFromQueue(): void {
		this.#current = this.queue.removeOldest();
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
		breakLoop: boolean;
	};

	// TODO(vxern): These ought to be moved onto the queueable.
	isLoopingSong: boolean;
	isLoopingCollection: boolean;

	startedAt: number;
	restoreAt: number;

	get current(): SongListing {
		return this.current;
	}

	get queueable(): Queueable {
		return this.queueable;
	}

	get playable(): Playable {
		return this.playable;
	}

	get isPaused(): boolean {
		return this.player.paused;
	}

	get volume(): number {
		return this.player.volume;
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
		this.flags = {
			isDisconnected: false,
			isDestroyed: false,
			breakLoop: false,
		};
		this.isLoopingSong = true;
		this.isLoopingCollection = true;
		this.startedAt = 0;
		this.restoreAt = 0;
	}

	receiveListing({ listing }: { listing: SongListing }): void {
		this.listings.queue.addNew(listing);
	}

	// TODO(vxern): Put this on the song collection.
	#_advanceSongCollection({ queueable }: { queueable: SongCollection }): void {
		if (!queueable.isLastInCollection) {
			if (this.isLoopingSong) {
				queueable.position -= 1;
			} else {
				queueable.position += 1;
			}

			return;
		}

		if (this.isLoopingCollection) {
			queueable.position = 0;
			return;
		}
	}

	async advanceQueueAndPlay(): Promise<void> {
		if (this.queueable instanceof SongCollection) {
			this.#_advanceSongCollection({ queueable: this.queueable });
		} else if (this.isLoopingSong) {
			await this.loadSong(this.playable);
			return;
		}

		this.listings.moveCurrentToHistory();

		if (this.listings.queue.isEmpty) {
			return;
		}

		this.listings.takeCurrentFromQueue();

		await this.loadSong(this.playable);
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
				this.isLoopingSong = value;
				break;
			}
			case "collection": {
				this.isLoopingCollection = value;
				break;
			}
		}
	}

	#_skipSongInSongCollection({
		queueable,
		controls,
	}: { queueable: SongCollection; controls: Partial<PositionControls> }): void {
		this.isLoopingSong = false;

		if (controls.by !== undefined) {
			queueable.position += controls.by - 1;
		}

		if (controls.to !== undefined) {
			queueable.position = controls.to - 2;
		}
	}

	#_skipSongCollection(): void {
		this.isLoopingCollection = false;

		this.listings.moveCurrentToHistory();
	}

	#_skipPlayable({ controls }: { controls: Partial<PositionControls> }): void {
		this.isLoopingSong = false;

		this.listings.moveCurrentToHistory();

		const count = controls.by ?? controls.to ?? 0;
		const listingsToMoveToHistory = Math.min(count, this.listings.queue.count);
		this.listings.moveFromQueueToHistory({ count: listingsToMoveToHistory });
	}

	async skip({
		skipCollection,
		controls,
	}: { skipCollection: boolean; controls: Partial<PositionControls> }): Promise<void> {
		if (this.queueable instanceof SongCollection) {
			if (skipCollection || this.queueable.isLastInCollection) {
				this.#_skipSongCollection();
			} else {
				this.#_skipSongInSongCollection({ queueable: this.queueable, controls });
			}
		} else {
			this.#_skipPlayable({ controls });
		}

		await this.player.stopTrack();
	}

	#_unskipSongCollection({ queueable }: { queueable: SongCollection }): void {
		this.isLoopingCollection = false;

		queueable.position -= 1;

		this.listings.moveCurrentToQueue();
		this.listings.moveFromHistoryToQueue({ count: 1 });
	}

	#_unskipSongInSongColletion({
		queueable,
		controls,
	}: { queueable: SongCollection; controls: Partial<PositionControls> }): void {
		this.isLoopingSong = false;

		if (controls.by !== undefined) {
			queueable.position -= controls.by + 1;
		}

		if (controls.to !== undefined) {
			queueable.position = controls.to - 2;
		}

		if (controls.by === undefined && controls.to === undefined) {
			queueable.position -= 2;
		}
	}

	#_unskipPlayable({ controls }: { controls: Partial<PositionControls> }): void {
		this.isLoopingSong = false;

		this.listings.moveCurrentToQueue();

		const count = controls.by ?? controls.to ?? 1;
		const listingsToMoveToQueue = Math.min(count, this.listings.history.count);
		this.listings.moveFromHistoryToQueue({ count: listingsToMoveToQueue });
	}

	async unskip({
		unskipCollection,
		controls,
	}: { unskipCollection: boolean; controls: Partial<PositionControls> }): Promise<void> {
		if (this.queueable instanceof SongCollection) {
			if (unskipCollection || this.queueable.isFirstInCollection) {
				this.#_unskipSongCollection({ queueable: this.queueable });
			} else {
				this.#_unskipSongInSongColletion({ queueable: this.queueable, controls });
			}
		} else {
			this.#_unskipPlayable({ controls });
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
			const previousLoopState = this.isLoopingCollection;
			this.isLoopingCollection = true;
			this.player.once("start", () => {
				this.isLoopingCollection = previousLoopState;
			});
		} else {
			const previousLoopState = this.isLoopingSong;
			this.isLoopingSong = true;
			this.player.once("start", () => {
				this.isLoopingSong = previousLoopState;
			});
		}

		if (this.queueable instanceof SongCollection) {
			if (collection) {
				this.queueable.position = -1;
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

	// TODO(vxern): Refactor this.
	async loadSong(
		song: Song | AudioStream,
		restore?: { paused: boolean; volume: number },
	): Promise<boolean | undefined> {
		const result = await this.player.node.rest.resolve(`ytsearch:${song.url}`);

		if (result === undefined || result.loadType === "error" || result.loadType === "empty") {
			this.isLoopingSong = false;

			const guildLocale = this.service.guildLocale;
			const strings = {
				title: this.service.client.localise("music.options.play.strings.failedToLoad.title", guildLocale)(),
				description: this.service.client.localise(
					"music.options.play.strings.failedToLoad.description",
					guildLocale,
				)({
					title: song.title,
				}),
			};

			this.service.client.bot.rest
				.sendMessage(this.channelId, {
					embeds: [
						{
							title: strings.title,
							description: strings.description,
							color: constants.colours.failure,
						},
					],
				})
				.catch(() =>
					this.service.log.warn(
						`Failed to send track load failure to ${this.service.client.diagnostics.channel(
							this.channelId,
						)} on ${this.service.client.diagnostics.guild(this.service.guildId)}.`,
					),
				);

			await this.advanceQueueAndPlay();

			return false;
		}

		let track: shoukaku.Track | undefined;
		if (result.loadType === "search") {
			track = result.data.at(0);
		}
		if (track === undefined) {
			return false;
		}

		if (this.queueable instanceof AudioStream) {
			this.queueable.title = track.info.title;
		}

		this.player.once("exception", async (reason) => {
			this.isLoopingSong = false;

			this.service.log.warn(`Failed to play track: ${reason.exception}`);

			const guildLocale = this.service.guildLocale;
			const strings = {
				title: this.service.client.localise("music.options.play.strings.failedToPlay.title", guildLocale)(),
				description: this.service.client.localise(
					"music.options.play.strings.failedToPlay.description",
					guildLocale,
				)({
					title: song.title,
				}),
			};

			this.service.client.bot.rest
				.sendMessage(this.channelId, {
					embeds: [
						{
							title: strings.title,
							description: strings.description,
							color: constants.colours.failure,
						},
					],
				})
				.catch(() =>
					this.service.log.warn(
						`Failed to send track play failure to ${this.service.client.diagnostics.channel(
							this.channelId,
						)} on ${this.service.client.diagnostics.guild(this.service.guildId)}.`,
					),
				);
		});

		this.player.once("end", async () => {
			this.player.removeAllListeners("trackException");

			if (this.flags.isDestroyed) {
				return;
			}

			if (this.flags.breakLoop) {
				this.flags.breakLoop = false;
				return;
			}

			this.restoreAt = 0;

			await this.advanceQueueAndPlay();
		});

		this.player.once("start", async () => {
			const now = Date.now();
			this.startedAt = now;

			if (this.restoreAt !== 0) {
				await this.player.seekTo(this.restoreAt);
			}

			if (restore !== undefined) {
				await this.player.setPaused(restore.paused);
			}
		});

		if (restore !== undefined) {
			await this.player.setGlobalVolume(restore.volume);
			await this.player.playTrack({ track: track.encoded });
			return;
		}

		await this.player.playTrack({ track: track.encoded });

		const guildLocale = this.service.guildLocale;
		const strings = {
			title: this.service.client.localise(
				"music.options.play.strings.nowPlaying.title.nowPlaying",
				guildLocale,
			)({
				listing_type: this.service.client.localise(
					(() => {
						const queueable = this.queueable;
						switch (true) {
							case queueable instanceof Song: {
								return "music.options.play.strings.nowPlaying.title.type.song";
							}
							case queueable instanceof AudioStream: {
								return "music.options.play.strings.nowPlaying.title.type.stream";
							}
							case queueable instanceof SongCollection: {
								return "music.options.play.strings.nowPlaying.title.type.songCollection";
							}
							default:
								return constants.special.missingString;
						}
					})(),
					guildLocale,
				)(),
			}),
			description: {
				nowPlaying: this.service.client.localise(
					"music.options.play.strings.nowPlaying.description.nowPlaying",
					guildLocale,
				),
				track:
					this.queueable instanceof SongCollection
						? this.service.client.localise(
								"music.options.play.strings.nowPlaying.description.track",
								guildLocale,
						  )({
								index: this.queueable.position + 1,
								number: this.queueable.songs.length,
								title: this.queueable.title,
						  })
						: "",
			},
		};

		this.service.client.bot.rest
			.sendMessage(this.channelId, {
				embeds: [
					{
						title: `${this.queueable.emoji} ${strings.title}`,
						description: strings.description.nowPlaying({
							song_information: strings.description.track,
							title: song.title,
							url: song.url,
							user_mention: mention(this.current.userId, { type: "user" }),
						}),
						color: constants.colours.notice,
					},
				],
			})
			.catch(() =>
				this.service.log.warn(
					`Failed to send now playing message to ${this.service.client.diagnostics.channel(
						this.channelId,
					)} on ${this.service.client.diagnostics.guild(this.service.guildId)}.`,
				),
			);

		return true;
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

	abstract get playable(): Playable;

	constructor({ title, url, emoji }: { title: string; url: string; emoji: string }) {
		this.title = title;
		this.url = url;
		this.emoji = emoji;
	}
}

abstract class Playable extends Queueable {
	get playable(): Playable {
		return this;
	}
}

/** Represents a musical piece, playable singly by the music controller. */
class Song extends Playable {
	constructor({ title, url }: { title: string; url: string }) {
		super({ title, url, emoji: constants.emojis.music.song });
	}
}

/** Represents a musical piece in stream format. */
class AudioStream extends Playable {
	constructor({ title, url }: { title: string; url: string }) {
		super({ title, url, emoji: constants.emojis.music.stream });
	}
}

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
	position: number;

	get playable(): Playable {
		return this.songs[this.position]!;
	}

	get isFirstInCollection(): boolean {
		return this.position === 0;
	}

	get isLastInCollection(): boolean {
		return this.position === this.songs.length - 1;
	}

	constructor({ title, url, songs }: { title: string; url: string; songs: Song[] }) {
		super({ title, url, emoji: constants.emojis.music.collection });

		this.songs = songs;
		this.position = 0;
	}
}

/**
 * Represents a playable object in the form of a song or a collection of songs
 * that contains key information about the listing.
 */
class SongListing {
	readonly queueable: Queueable;
	readonly userId: bigint;
	// TODO(vxern): Is this needed?
	readonly source?: string;

	constructor({ queueable, userId }: { queueable: Queueable; userId: bigint }) {
		this.queueable = queueable;
		this.userId = userId;
	}
}

export { MusicService, Song, SongCollection, AudioStream, SongListing };
