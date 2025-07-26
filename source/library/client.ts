import type { Environment } from "rost:core/loaders/environment";
import type pino from "pino";
import { Collector, type InteractionCollector } from "rost/collectors";
import commands from "rost/commands/commands";
import { DiscordConnection } from "rost/connection";
import { Diagnostics } from "rost/diagnostics";
import { CacheStore } from "rost/stores/cache";
import { CommandStore } from "rost/stores/commands";
import { DatabaseStore } from "rost/stores/database";
import { EventStore } from "rost/stores/events";
import { GuildStore } from "rost/stores/guilds";
import { InteractionStore } from "rost/stores/interactions";
import { JournallingStore } from "rost/stores/journalling";
import { LocalisationStore, type RawLocalisations } from "rost/stores/localisations";
import { PluginStore } from "rost/stores/plugins";
import { ServiceStore } from "rost/stores/services";

class Client {
	readonly log: pino.Logger;
	readonly environment: Environment;
	readonly diagnostics: Diagnostics;

	readonly #localisations: LocalisationStore;
	readonly #commands: CommandStore;
	readonly interactions: InteractionStore;
	readonly #cache: CacheStore;
	readonly database: DatabaseStore;
	readonly services: ServiceStore;
	readonly #events: EventStore;
	readonly #journalling: JournallingStore;
	readonly #guilds: GuildStore;
	readonly #plugins: PluginStore;
	readonly #connection: DiscordConnection;

	readonly #channelDeletes: Collector<"channelDelete">;

	#isStopping = false;
	#stopSignal: string | undefined;

	get localiseRaw(): LocalisationStore["localiseRaw"] {
		return this.#localisations.localiseRaw.bind(this.#localisations);
	}

	get localise(): LocalisationStore["localise"] {
		return this.#localisations.localise.bind(this.#localisations);
	}

	get localiseCommand(): LocalisationStore["localiseCommand"] {
		return this.#localisations.localiseCommand.bind(this.#localisations);
	}

	get pluralise(): LocalisationStore["pluralise"] {
		return this.#localisations.pluralise.bind(this.#localisations);
	}

	get commands(): CommandStore["commands"] {
		return this.#commands.commands;
	}

	get isShowable(): CommandStore["isShowable"] {
		return this.#commands.isShowable.bind(this.#commands);
	}

	get unsupported(): InteractionStore["unsupported"] {
		return this.interactions.unsupported.bind(this.interactions);
	}

	get notice(): InteractionStore["notice"] {
		return this.interactions.notice.bind(this.interactions);
	}

	get noticed(): InteractionStore["noticed"] {
		return this.interactions.noticed.bind(this.interactions);
	}

	get success(): InteractionStore["success"] {
		return this.interactions.success.bind(this.interactions);
	}

	get succeeded(): InteractionStore["succeeded"] {
		return this.interactions.succeeded.bind(this.interactions);
	}

	get pushback(): InteractionStore["pushback"] {
		return this.interactions.pushback.bind(this.interactions);
	}

	get pushedBack(): InteractionStore["pushedBack"] {
		return this.interactions.pushedBack.bind(this.interactions);
	}

	get warning(): InteractionStore["warning"] {
		return this.interactions.warning.bind(this.interactions);
	}

	get warned(): InteractionStore["warned"] {
		return this.interactions.warned.bind(this.interactions);
	}

	get error(): InteractionStore["error"] {
		return this.interactions.error.bind(this.interactions);
	}

	get errored(): InteractionStore["errored"] {
		return this.interactions.errored.bind(this.interactions);
	}

	get failure(): InteractionStore["failure"] {
		return this.interactions.failure.bind(this.interactions);
	}

	get failed(): InteractionStore["failed"] {
		return this.interactions.failed.bind(this.interactions);
	}

	get death(): InteractionStore["death"] {
		return this.interactions.death.bind(this.interactions);
	}

	get died(): InteractionStore["died"] {
		return this.interactions.died.bind(this.interactions);
	}

	get acknowledge(): InteractionStore["acknowledge"] {
		return this.interactions.acknowledge.bind(this.interactions);
	}

	get postponeReply(): InteractionStore["postponeReply"] {
		return this.interactions.postponeReply.bind(this.interactions);
	}

	get reply(): InteractionStore["reply"] {
		return this.interactions.reply.bind(this.interactions);
	}

	get editReply(): InteractionStore["editReply"] {
		return this.interactions.editReply.bind(this.interactions);
	}

	get deleteReply(): InteractionStore["deleteReply"] {
		return this.interactions.deleteReply.bind(this.interactions);
	}

	get respond(): InteractionStore["respond"] {
		return this.interactions.respond.bind(this.interactions);
	}

	get displayModal(): InteractionStore["displayModal"] {
		return this.interactions.displayModal.bind(this.interactions);
	}

	get resolveInteractionToMember(): InteractionStore["resolveInteractionToMember"] {
		return this.interactions.resolveInteractionToMember.bind(this.interactions);
	}

	get autocompleteMembers(): InteractionStore["autocompleteMembers"] {
		return this.interactions.autocompleteMembers.bind(this.interactions);
	}

	get registerCollector(): EventStore["registerCollector"] {
		return this.#events.registerCollector.bind(this.#events);
	}

	get entities(): CacheStore["entities"] {
		return this.#cache.entities;
	}

	get documents(): CacheStore["documents"] {
		return this.#cache.documents;
	}

	get tryLog(): JournallingStore["tryLog"] {
		return this.#journalling.tryLog.bind(this.#journalling);
	}

	get registerInteractionCollector(): <Metadata extends string[]>(
		collector: InteractionCollector<Metadata>,
	) => Promise<void> {
		return (collector) => this.#events.registerCollector("interactionCreate", collector);
	}

	get bot(): DiscordConnection["bot"] {
		return this.#connection.bot;
	}

	constructor({
		log,
		environment,
		localisations,
	}: { log: pino.Logger; environment: Environment; localisations: RawLocalisations }) {
		this.log = log.child({ name: "Client" });
		this.environment = environment;
		this.diagnostics = new Diagnostics(this);

		this.#localisations = new LocalisationStore({ log, localisations });
		this.#commands = CommandStore.create(this, {
			localisations: this.#localisations,
			templates: commands,
		});
		this.interactions = new InteractionStore(this, { commands: this.#commands });
		this.#cache = new CacheStore({ log });
		this.database = DatabaseStore.create({ log, environment, cache: this.#cache });
		this.services = new ServiceStore(this);
		this.#events = new EventStore(this);
		this.#journalling = new JournallingStore(this);
		this.#guilds = new GuildStore(this, { services: this.services, commands: this.#commands });
		this.#plugins = new PluginStore(this);
		this.#connection = new DiscordConnection({
			log,
			environment,
			eventHandlers: this.#events.buildEventHandlers(),
			cacheHandlers: this.#cache.buildCacheHandlers(),
		});

		this.#channelDeletes = new Collector<"channelDelete">();
	}

	async #setupCollectors(): Promise<void> {
		this.log.info("Setting up event collectors...");

		this.#channelDeletes.onCollect((channel) => {
			this.entities.channels.delete(channel.id);

			if (channel.guildId !== undefined) {
				this.entities.guilds.get(channel.guildId)?.channels?.delete(channel.id);
			}
		});

		await this.registerCollector("channelDelete", this.#channelDeletes);

		this.log.info("Event collectors set up.");
	}

	#teardownCollectors(): void {
		this.log.info("Tearing down event collectors...");

		this.#channelDeletes.close();

		this.log.info("Event collectors torn down.");
	}

	async start(): Promise<void> {
		this.#stopOnSignal();

		this.log.info("Starting client...");

		await this.database.setup({ prefetchDocuments: true });
		await this.services.setup();
		await this.#journalling.setup();
		await this.#guilds.setup();
		await this.interactions.setup();
		await this.#setupCollectors();
		await this.#connection.open();
		await this.#plugins.setup();

		this.log.info("Client started.");
	}

	async stop({ signal }: { signal?: string }): Promise<void> {
		if (this.#isStopping) {
			if (this.#stopSignal === signal) {
				this.log.info("The client is already being stopped...");
				return;
			}

			return;
		}

		this.log.info("Stopping client...");

		this.#isStopping = true;
		this.#stopSignal = signal;

		await this.database.teardown();
		await this.services.teardown();
		this.#journalling.teardown();
		await this.#guilds.teardown();
		await this.interactions.teardown();
		this.#teardownCollectors();
		await this.#plugins.teardown();
		await this.#connection.close();

		this.#isStopping = false;
		this.#stopSignal = undefined;

		this.log.info("Client stopped.");
	}

	#stopOnSignal(): void {
		process.on("SIGINT", async () => {
			await this.stop({ signal: "SIGINT" });
			process.exit();
		});
		process.on("SIGTERM", async () => {
			await this.stop({ signal: "SIGTERM" });
			process.exit();
		});
	}
}

export { Client };
