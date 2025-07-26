import type { Client } from "rost/client";
import { Collector } from "rost/collectors";
import { GlobalService } from "rost/services/service";
import * as shoukaku from "shoukaku";

class ClientConnector extends shoukaku.Connector {
	declare readonly client: Client;

	readonly #nodes: shoukaku.NodeOption[];
	readonly #voiceStateUpdates: Collector<"voiceStateUpdate">;
	readonly #voiceServerUpdates: Collector<"voiceServerUpdate">;

	constructor(client: Client, { nodes }: { nodes: shoukaku.NodeOption[] }) {
		super(client);

		this.#nodes = nodes;
		this.#voiceStateUpdates = new Collector<"voiceStateUpdate">();
		this.#voiceServerUpdates = new Collector<"voiceServerUpdate">();
	}

	/**
	 * @remarks
	 * This method is intentionally not a getter; it conforms to shoukaku's Connector signature.
	 */
	getId(): string {
		return this.client.bot.id.toString();
	}

	listen(_: shoukaku.NodeOption[]): void {
		// Do nothing.
	}

	sendPacket(shardId: number, payload: Discord.ShardSocketRequest, important: boolean): void {
		const shard = this.client.bot.gateway.shards.get(shardId);
		if (shard === undefined) {
			return;
		}

		shard.send(payload, important).then();
	}

	async setup(): Promise<void> {
		this.#voiceStateUpdates.onCollect((voiceState) =>
			this.manager?.connections.get(voiceState.guildId.toString())?.setStateUpdate({
				session_id: voiceState.sessionId,
				channel_id: voiceState.channelId?.toString(),
				self_deaf: voiceState.toggles.selfDeaf,
				self_mute: voiceState.toggles.selfMute,
			}),
		);
		this.#voiceServerUpdates.onCollect((voiceServer) =>
			this.manager?.connections.get(voiceServer.guildId.toString())?.setServerUpdate({
				token: voiceServer.token,
				guild_id: voiceServer.guildId.toString(),
				endpoint: voiceServer.endpoint!,
			}),
		);

		await this.client.registerCollector("voiceStateUpdate", this.#voiceStateUpdates);
		await this.client.registerCollector("voiceServerUpdate", this.#voiceServerUpdates);

		this.ready(this.#nodes);
	}

	async teardown(): Promise<void> {
		await this.#voiceStateUpdates.close();
		await this.#voiceServerUpdates.close();
	}
}

class LavalinkService extends GlobalService {
	readonly #connector: ClientConnector;
	readonly manager: shoukaku.Shoukaku;

	constructor(client: Client, { host, port, password }: { host: string; port: string; password: string }) {
		super(client, { identifier: "LavalinkService" });

		const nodes: shoukaku.NodeOption[] = [
			{
				name: "main",
				url: `${host}:${Number(port)}`,
				auth: password,
			},
		];

		this.#connector = new ClientConnector(client, { nodes });
		this.manager = new shoukaku.Shoukaku(this.#connector, nodes, {
			resume: true,
			resumeTimeout: constants.time.minute / 1000,
			resumeByLibrary: true,
			reconnectTries: -1,
			reconnectInterval: constants.time.minute / 1000,
			restTimeout: (5 * constants.time.second) / 1000,
			userAgent: constants.USER_AGENT,
		});
		this.manager.setMaxListeners(0);
	}

	static tryCreate(client: Client): LavalinkService | undefined {
		if (
			client.environment.lavalinkHost === undefined ||
			client.environment.lavalinkPort === undefined ||
			client.environment.lavalinkPassword === undefined
		) {
			return undefined;
		}

		return new LavalinkService(client, {
			host: client.environment.lavalinkHost,
			port: client.environment.lavalinkPort,
			password: client.environment.lavalinkPassword,
		});
	}

	async start(): Promise<void> {
		this.manager.on("error", (_, error) => {
			if (error?.message?.includes("ECONNREFUSED")) {
				return;
			}

			this.log.error(error, "The audio node has encountered an error.");
		});

		this.manager.on("ready", (_, reconnected) => {
			if (reconnected) {
				this.log.info("Reconnected to audio node.");
			} else {
				this.log.info("Connected to audio node.");
			}
		});

		await this.#connector.setup();
	}

	async stop(): Promise<void> {
		this.manager.removeAllListeners();

		for (const player of Object.values(this.manager.players)) {
			await player.destroy();
		}

		await this.#connector.teardown();
	}
}

// REMINDER(vxern): Remove this once Shoukaku works correctly on Bun.
// https://github.com/oven-sh/bun/issues/5951
function patchShoukakuWebSockets(): void {
	// @ts-expect-error: Private symbol.
	shoukaku.Node.prototype.open = function (_) {
		this.reconnects = 0;
		this.state = shoukaku.Constants.State.NEARLY;
	};
	shoukaku.Node.prototype.connect = function () {
		if (!this.manager.id) {
			throw new Error("Don't connect a node when the library is not yet ready");
		}

		if (this.destroyed) {
			throw new Error(
				"You can't re-use the same instance of a node once disconnected, please re-add the node again",
			);
		}

		this.state = shoukaku.Constants.State.CONNECTING;

		const headers: shoukaku.NonResumableHeaders | shoukaku.ResumableHeaders = {
			"Client-Name": shoukaku.Constants.ShoukakuClientInfo,
			"User-Agent": this.manager.options.userAgent,
			// @ts-expect-error: This is fine.
			Authorization: this.auth,
			"User-Id": this.manager.id,
		};

		if (this.sessionId) {
			headers["Session-Id"] = this.sessionId;
		}
		if (!this.initialized) {
			this.initialized = true;
		}

		// @ts-expect-error: This is fine.
		const onOpen = (event) => this.open(event);
		// @ts-expect-error: This is fine.
		const onClose = (event) => this.close(event.code, event.reason);
		// @ts-expect-error: This is fine.
		const onError = (event) => this.error(event.error);
		// @ts-expect-error: This is fine.
		const onMessage = (event) => this.message(event.data).catch((error) => this.error(error as Error));

		// @ts-expect-error: Private symbol.
		this.ws = new WebSocket(
			// @ts-expect-error: Private symbol.
			this.url,
			{ headers },
		);
		// @ts-expect-error: Private symbol.
		this.ws.addEventListener("open", onOpen, { once: true });
		// @ts-expect-error: Private symbol.
		this.ws.addEventListener("close", onClose, { once: true });
		// @ts-expect-error: Private symbol.
		this.ws.addEventListener("error", onError);
		// @ts-expect-error: Private symbol.
		this.ws.addEventListener("message", onMessage);

		// @ts-expect-error: This is fine.
		this.ws.removeAllListeners = function (_) {
			// @ts-expect-error: Private symbol.
			this.removeEventListener("open", onOpen);
			// @ts-expect-error: Private symbol.
			this.removeEventListener("close", onClose);
			// @ts-expect-error: Private symbol.
			this.removeEventListener("error", onError);
			// @ts-expect-error: Private symbol.
			this.removeEventListener("message", onMessage);
		};
	};
}

patchShoukakuWebSockets();

export { LavalinkService };
