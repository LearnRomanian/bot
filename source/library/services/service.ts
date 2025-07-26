import type pino from "pino";
import type { Client } from "rost/client";
import type { Guild } from "rost/models/guild";

abstract class Service {
	readonly identifier: string;
	readonly log: pino.Logger;
	readonly client: Client;

	constructor(client: Client, { identifier }: { identifier: string }) {
		this.identifier = identifier;
		this.log = client.log.child({ name: identifier });
		this.client = client;
	}

	abstract start(): Promise<void>;

	abstract stop(): Promise<void>;
}

abstract class GlobalService extends Service {
	async start(): Promise<void> {
		// Do nothing.
	}

	async stop(): Promise<void> {
		// Do nothing.
	}
}

abstract class LocalService extends Service {
	readonly guildId: bigint;
	readonly guildIdString: string;

	get guild(): Rost.Guild {
		return this.client.entities.guilds.get(this.guildId)!;
	}

	get guildDocument(): Guild {
		return this.client.documents.guilds.get(this.guildIdString)!;
	}

	get guildLocale(): Discord.Locale {
		return this.guildDocument.locales.source;
	}

	constructor(client: Client, { identifier, guildId }: { identifier: string; guildId: bigint }) {
		super(client, { identifier });

		this.guildId = guildId;
		this.guildIdString = guildId.toString();
	}

	async start(): Promise<void> {
		// Do nothing.
	}

	async stop(): Promise<void> {
		// Do nothing.
	}

	async getAllMessages({ channelId }: { channelId: bigint }): Promise<Discord.Message[] | undefined> {
		const buffer: Discord.Message[] = [];

		let isFinished = false;
		while (!isFinished) {
			const chunk = await this.client.bot.helpers
				.getMessages(channelId, {
					limit: 100,
					before: buffer.length === 0 ? undefined : buffer.at(-1)?.id,
				})
				.catch((error) => {
					this.client.log.warn(
						error,
						`Failed to get all messages from ${this.client.diagnostics.channel(channelId)}.`,
					);
					return undefined;
				});
			if (chunk === undefined) {
				return undefined;
			}

			if (chunk.length < 100) {
				isFinished = true;
			}

			buffer.push(...chunk);
		}

		return buffer;
	}
}

export { Service, GlobalService, LocalService };
