import type { DesiredProperties, DesiredPropertiesBehaviour } from "rost:constants/properties";
import type pino from "pino";
import type { Collector } from "rost/collectors";

type Event = keyof Discord.EventHandlers<DesiredProperties, DesiredPropertiesBehaviour>;
class EventStore {
	readonly log: pino.Logger;

	readonly #collectors: Map<Event, Set<Collector<Event>>>;

	constructor({ log }: { log: pino.Logger }) {
		this.log = log.child({ name: "EventStore" });

		this.#collectors = new Map();
	}

	buildEventHandlers(): Partial<Discord.EventHandlers<DesiredProperties, DesiredPropertiesBehaviour>> {
		return {
			// We do not collect events from Discordeno's `raw()` sink; Use the sink for the specific event you want to
			// handle.
			ready: (payload, rawPayload) => this.collectEvent(undefined, "ready", { args: [payload, rawPayload] }),
			interactionCreate: (interactionRaw) =>
				this.collectEvent(interactionRaw.guildId, "interactionCreate", { args: [interactionRaw] }),
			guildMemberAdd: (member, user) =>
				this.collectEvent(member.guildId, "guildMemberAdd", { args: [member, user] }),
			guildMemberRemove: (user, guildId) =>
				this.collectEvent(guildId, "guildMemberRemove", { args: [user, guildId] }),
			guildMemberUpdate: (member, user) =>
				this.collectEvent(member.guildId, "guildMemberUpdate", { args: [member, user] }),
			messageCreate: (message) => this.collectEvent(message.guildId, "messageCreate", { args: [message] }),
			messageDelete: (payload, message) =>
				this.collectEvent(payload.guildId, "messageDelete", { args: [payload, message] }),
			messageDeleteBulk: (payload) =>
				this.collectEvent(payload.guildId, "messageDeleteBulk", { args: [payload] }),
			messageUpdate: (message) => this.collectEvent(message.guildId, "messageUpdate", { args: [message] }),
			voiceServerUpdate: (payload) =>
				this.collectEvent(payload.guildId, "voiceServerUpdate", { args: [payload] }),
			voiceStateUpdate: (voiceState) =>
				this.collectEvent(voiceState.guildId, "voiceStateUpdate", { args: [voiceState] }),
			channelCreate: (channel) => this.collectEvent(channel.guildId, "channelCreate", { args: [channel] }),
			channelDelete: (channel) => this.collectEvent(channel.guildId, "channelDelete", { args: [channel] }),
			channelPinsUpdate: (data) => this.collectEvent(data.guildId, "channelPinsUpdate", { args: [data] }),
			channelUpdate: (channel) => this.collectEvent(channel.guildId, "channelUpdate", { args: [channel] }),
			guildEmojisUpdate: (payload) =>
				this.collectEvent(payload.guildId, "guildEmojisUpdate", { args: [payload] }),
			guildBanAdd: (user, guildId) => this.collectEvent(guildId, "guildBanAdd", { args: [user, guildId] }),
			guildBanRemove: (user, guildId) => this.collectEvent(guildId, "guildBanRemove", { args: [user, guildId] }),
			guildCreate: (guild) => this.collectEvent(guild.id, "guildCreate", { args: [guild] }),
			guildDelete: (id, shardId) => this.collectEvent(id, "guildDelete", { args: [id, shardId] }),
			guildUpdate: (guild) => this.collectEvent(guild.id, "guildUpdate", { args: [guild] }),
			roleCreate: (role) => this.collectEvent(role.guildId, "roleCreate", { args: [role] }),
			roleDelete: (role) => this.collectEvent(role.guildId, "roleDelete", { args: [role] }),
			roleUpdate: (role) => this.collectEvent(role.guildId, "roleUpdate", { args: [role] }),
		};
	}

	collectEvent<Event extends keyof Discord.EventHandlers<DesiredProperties, DesiredPropertiesBehaviour>>(
		guildId: bigint | undefined,
		event: Event,
		{ args }: { args: Parameters<Discord.EventHandlers<DesiredProperties, DesiredPropertiesBehaviour>[Event]> },
	): void {
		const collectors = this.#collectors.get(event);
		if (collectors !== undefined) {
			for (const collector of collectors) {
				if (collector.guildId !== undefined && collector.guildId !== guildId) {
					continue;
				}

				if (collector.filter !== undefined && !collector.filter(...args)) {
					continue;
				}

				collector.dispatchCollect?.(...args)?.then();
			}
		}
	}

	async registerCollector<Event extends keyof Discord.EventHandlers<DesiredProperties, DesiredPropertiesBehaviour>>(
		event: Event,
		collector: Collector<Event>,
	): Promise<void> {
		this.#registerCollector(event, collector);

		collector.initialise();

		collector.done.then(() => {
			this.#unregisterCollector(event, collector);
		});
	}

	#registerCollector(event: Event, collector: Collector<Event>): void {
		this.log.debug(`Registering collector for '${event}'...`);

		const collectors = this.#collectors.get(event);
		if (collectors === undefined) {
			this.#collectors.set(event, new Set([collector]));
			return;
		}

		collectors.add(collector);
	}

	#unregisterCollector(event: Event, collector: Collector<Event>): void {
		const collectors = this.#collectors.get(event);
		if (collectors === undefined) {
			throw new Error(`Collectors for event '${event}' unexpectedly missing.`);
		}

		collectors.delete(collector);
	}
}

export { EventStore };
