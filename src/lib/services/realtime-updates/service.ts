import { Client, handleGuildCreate, handleGuildDelete } from "../../client";
import { Document } from "../../database/document";
import { Guild } from "../../database/structs/guild";
import diagnostics from "../../diagnostics";
import { LocalService } from "../service";
import * as Discord from "@discordeno/bot";
import Fauna from "fauna";

type StreamSubscription = Fauna.Subscription<Omit<Fauna.SubscriptionEventHandlers, "snapshot">>;

class RealtimeUpdateService extends LocalService {
	readonly documentReference: Fauna.Expr;
	streamSubscription: StreamSubscription | undefined;

	constructor([client, bot]: [Client, Discord.Bot], guildId: bigint, documentReference: Fauna.Expr) {
		super([client, bot], guildId);
		this.documentReference = documentReference;
	}

	async start(): Promise<void> {
		const guild = this.guild;
		if (guild === undefined) {
			return;
		}

		this.client.database.log.info(`Streaming updates to guild document on ${diagnostics.display.guild(guild)}...`);

		const streamSubscription = this.client.database.client
			.stream(this.documentReference, { fields: ["action", "document"] })
			.on("start", (_) => {})
			.on("version", async (data, _) => {
				this.client.database.log.info(
					`Detected update to configuration for ${diagnostics.display.guild(guild)}. Updating...`,
				);

				const document = data.document as Document<Guild> | undefined;
				if (document === undefined) {
					return;
				}

				this.client.database.cache.guildById.set(document.data.id, document);

				await handleGuildDelete(this.client, guild.id);
				await handleGuildCreate([this.client, this.bot], guild, { isUpdate: true });
			})
			.on("error", (_) => {
				this.client.database.log.info(
					`Guild document stream closed for ${diagnostics.display.guild(guild)}. Reopening in 10 seconds...`,
				);
				streamSubscription.close();
				setTimeout(() => {
					this.client.database.adapters.guilds.fetch(this.client, "id", this.guildIdString);
					this.start();
				}, 10000);
			});
		this.streamSubscription = streamSubscription;
		streamSubscription.start();
	}

	async stop(): Promise<void> {
		this.streamSubscription?.close();
	}
}

export { RealtimeUpdateService };
