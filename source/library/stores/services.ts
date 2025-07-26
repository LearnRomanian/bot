import { isDefined } from "rost:core/utilities";
import type pino from "pino";
import type { Client } from "rost/client";
import type { Guild } from "rost/models/guild";
import { AlertService } from "rost/services/alert";
import { AntiFloodService } from "rost/services/anti-flood";
import { DynamicVoiceChannelService } from "rost/services/dynamic-voice-channels";
import { EntryService } from "rost/services/entry";
import { InteractionRepetitionService } from "rost/services/interaction-repetition";
import { LavalinkService } from "rost/services/lavalink";
import { MusicService } from "rost/services/music";
import { InformationNoticeService } from "rost/services/notices/information";
import { ResourceNoticeService } from "rost/services/notices/resources";
import { RoleNoticeService } from "rost/services/notices/roles";
import { WelcomeNoticeService } from "rost/services/notices/welcome";
import { ReportPromptService } from "rost/services/prompts/reports";
import { ResourcePromptService } from "rost/services/prompts/resources";
import { SuggestionPromptService } from "rost/services/prompts/suggestions";
import { TicketPromptService } from "rost/services/prompts/tickets";
import { VerificationPromptService } from "rost/services/prompts/verification";
import { RoleIndicatorService } from "rost/services/role-indicators";
import type { GlobalService, LocalService, Service } from "rost/services/service";
import { StatusService } from "rost/services/status";

interface GlobalServices {
	readonly lavalink?: LavalinkService;
	readonly interactionRepetition: InteractionRepetitionService;
	readonly status: StatusService;
}

interface LocalServices {
	readonly alerts: AlertService;
	readonly antiFlood: AntiFloodService;
	readonly dynamicVoiceChannels: DynamicVoiceChannelService;
	readonly entry: EntryService;
	readonly music: MusicService;
	readonly informationNotices: InformationNoticeService;
	readonly resourceNotices: ResourceNoticeService;
	readonly roleNotices: RoleNoticeService;
	readonly welcomeNotices: WelcomeNoticeService;
	readonly reportPrompts: ReportPromptService;
	readonly resourcePrompts: ResourcePromptService;
	readonly suggestionPrompts: SuggestionPromptService;
	readonly ticketPrompts: TicketPromptService;
	readonly verificationPrompts: VerificationPromptService;
	readonly roleIndicators: RoleIndicatorService;
}

interface CustomServices {
	readonly global: GlobalService[];
	readonly local: Map<bigint, Set<LocalService>>;
}

class ServiceStore {
	readonly log: pino.Logger;

	readonly #client: Client;
	readonly #global: GlobalServices;
	readonly #local: { [K in keyof LocalServices]: Map<bigint, LocalServices[K]> };
	readonly #custom: CustomServices;

	get #globalServices(): GlobalService[] {
		return [...Object.values(this.#global).filter(isDefined), ...this.#custom.global];
	}

	get #localServices(): LocalService[] {
		return [...Object.values(this.#local), ...Object.values(this.#custom.local)].flatMap((services) => [
			...services.values(),
		]);
	}

	constructor(client: Client) {
		this.log = client.log.child({ name: "ServiceStore" });

		const lavalinkService = LavalinkService.tryCreate(client);
		if (lavalinkService === undefined) {
			this.log.warn(
				"One or more of `LAVALINK_HOST`, `LAVALINK_PORT` or `LAVALINK_PASSWORD` have not been provided. Rost will not serve audio sessions.",
			);
		}

		this.#client = client;
		this.#global = {
			lavalink: lavalinkService,
			interactionRepetition: new InteractionRepetitionService(client),
			status: new StatusService(client),
		};
		this.#local = {
			alerts: new Map(),
			antiFlood: new Map(),
			dynamicVoiceChannels: new Map(),
			entry: new Map(),
			music: new Map(),
			informationNotices: new Map(),
			resourceNotices: new Map(),
			roleNotices: new Map(),
			welcomeNotices: new Map(),
			reportPrompts: new Map(),
			resourcePrompts: new Map(),
			suggestionPrompts: new Map(),
			ticketPrompts: new Map(),
			verificationPrompts: new Map(),
			roleIndicators: new Map(),
		};
		this.#custom = {
			global: [],
			local: new Map(),
		};
	}

	#localServicesFor({ guildId }: { guildId: bigint }): LocalService[] {
		return [
			...Object.values(this.#local)
				.map((services) => services.get(guildId))
				.filter(isDefined),
			...(this.#custom.local.get(guildId)?.values() ?? []),
		];
	}

	async setup(): Promise<void> {
		this.log.info("Setting up service store...");

		await this.#startGlobalServices();
		// Local services are started when Rost receives a guild.

		this.log.info("Service store set up.");
	}

	async teardown(): Promise<void> {
		this.log.info("Tearing down service store...");

		await this.#stopGlobalServices();
		await this.#stopAllLocalServices();

		this.log.info("Service store torn down.");
	}

	async #startGlobalServices(): Promise<void> {
		const services = this.#globalServices;

		this.log.info(`Starting global services... (${services.length} services to start)`);

		await this.#startServices(services);

		this.log.info("Global services started.");
	}

	async #stopGlobalServices(): Promise<void> {
		const services = this.#globalServices;

		this.log.info(`Stopping global services... (${services.length} services to stop)`);

		await this.#stopServices(services);

		this.log.info("Global services stopped.");
	}

	async startForGuild({ guildId, guildDocument }: { guildId: bigint; guildDocument: Guild }): Promise<void> {
		const services: Service[] = [];

		if (guildDocument.hasEnabled("informationNotices")) {
			const service = new InformationNoticeService(this.#client, { guildId });
			services.push(service);

			this.#local.informationNotices.set(guildId, service);
		}

		if (guildDocument.hasEnabled("resourceNotices")) {
			const service = new ResourceNoticeService(this.#client, { guildId });
			services.push(service);

			this.#local.resourceNotices.set(guildId, service);
		}

		if (guildDocument.hasEnabled("roleNotices")) {
			const service = new RoleNoticeService(this.#client, { guildId });
			services.push(service);

			this.#local.roleNotices.set(guildId, service);
		}

		if (guildDocument.hasEnabled("welcomeNotices")) {
			const service = new WelcomeNoticeService(this.#client, { guildId });
			services.push(service);

			this.#local.welcomeNotices.set(guildId, service);
		}

		if (guildDocument.hasEnabled("alerts")) {
			const service = new AlertService(this.#client, { guildId });
			services.push(service);

			this.#local.alerts.set(guildId, service);
		}

		if (guildDocument.hasEnabled("reports")) {
			const service = new ReportPromptService(this.#client, { guildId });
			services.push(service);

			this.#local.reportPrompts.set(guildId, service);
		}

		if (guildDocument.hasEnabled("antiFlood")) {
			const service = new AntiFloodService(this.#client, { guildId });
			services.push(service);

			this.#local.antiFlood.set(guildId, service);
		}

		if (guildDocument.hasEnabled("verification")) {
			const service = new VerificationPromptService(this.#client, { guildId });
			services.push(service);

			this.#local.verificationPrompts.set(guildId, service);
		}

		if (guildDocument.hasEnabled("dynamicVoiceChannels")) {
			const service = new DynamicVoiceChannelService(this.#client, { guildId });
			services.push(service);

			this.#local.dynamicVoiceChannels.set(guildId, service);
		}

		if (guildDocument.hasEnabled("entry")) {
			const service = new EntryService(this.#client, { guildId });
			services.push(service);

			this.#local.entry.set(guildId, service);
		}

		if (guildDocument.hasEnabled("roleIndicators")) {
			const service = new RoleIndicatorService(this.#client, { guildId });
			services.push(service);

			this.#local.roleIndicators.set(guildId, service);
		}

		if (guildDocument.hasEnabled("suggestions")) {
			const service = new SuggestionPromptService(this.#client, { guildId });
			services.push(service);

			this.#local.suggestionPrompts.set(guildId, service);
		}

		if (guildDocument.hasEnabled("tickets")) {
			const service = new TicketPromptService(this.#client, { guildId });
			services.push(service);

			this.#local.ticketPrompts.set(guildId, service);
		}

		if (guildDocument.hasEnabled("resourceSubmissions")) {
			const service = new ResourcePromptService(this.#client, { guildId });
			services.push(service);

			this.#local.resourcePrompts.set(guildId, service);
		}

		if (guildDocument.hasEnabled("music") && this.#global.lavalink !== undefined) {
			const service = new MusicService(this.#client, { guildId });
			services.push(service);

			this.#local.music.set(guildId, service);
		}

		await this.#startLocalServices({ guildId, services });
	}

	async stopForGuild({ guildId }: { guildId: bigint }): Promise<void> {
		await this.#stopLocalServices({ guildId });
	}

	async #startLocalServices({ guildId, services }: { guildId: bigint; services: Service[] }): Promise<void> {
		if (services.length === 0) {
			this.log.info(`There were no local services to start on ${this.#client.diagnostics.guild(guildId)}.`);
			return;
		}

		this.log.info(
			`Starting local services on ${this.#client.diagnostics.guild(guildId)}... (${services.length} services to start)`,
		);

		await this.#startServices(services);

		this.log.info(`Local services on ${this.#client.diagnostics.guild(guildId)} started.`);
	}

	async #stopLocalServices({ guildId }: { guildId: bigint }): Promise<void> {
		const services = this.#localServicesFor({ guildId });
		if (services.length === 0) {
			this.log.info(`There were no local services to stop on ${this.#client.diagnostics.guild(guildId)}.`);
			return;
		}

		this.log.info(
			`Stopping services on ${this.#client.diagnostics.guild(guildId)}... (${services.length} services to stop)`,
		);

		await this.#stopServices(services);

		this.log.info(`Local services on ${this.#client.diagnostics.guild(guildId)} stopped.`);
	}

	async #stopAllLocalServices(): Promise<void> {
		const services = this.#localServices;

		this.log.info(`Stopping all local services... (${services.length} services to stop)`);

		await this.#stopServices(services);

		this.log.info("All local services stopped.");
	}

	async #startServices(services: Service[]): Promise<void> {
		await Promise.all(services.map((service) => service.start()));
	}

	async #stopServices(services: Service[]): Promise<void> {
		await Promise.all(services.map((service) => service.stop()));
	}

	/**
	 * Registers and starts a service at runtime.
	 *
	 * @remarks
	 * This should only be used for loading services inside of plugins.
	 */
	async loadLocalService(service: LocalService): Promise<void> {
		this.log.info(`Loading local service ${service.identifier}...`);

		if (this.#custom.local.has(service.guildId)) {
			this.#custom.local.get(service.guildId)!.add(service);
		} else {
			this.#custom.local.set(service.guildId, new Set([service]));
		}

		await service.start();

		this.log.info(`Local service ${service.identifier} has been loaded.`);
	}

	/**
	 * Unregisters and stops a service at runtime.
	 *
	 * @remarks
	 * This should only be used for unloading services inside of plugins.
	 */
	async unloadLocalService(service: LocalService, { guildId }: { guildId: bigint }): Promise<void> {
		this.log.info(`Unloading custom local service ${service.identifier}...`);

		const isRemoved = this.#custom.local.get(guildId)?.delete(service) ?? false;
		if (isRemoved === undefined) {
			this.log.warn(`Could not unload local service ${service.identifier}: It wasn't loaded previously.`);
			return;
		}

		await service.stop();

		this.log.info(`Local service ${service.identifier} has been unloaded.`);
	}

	hasGlobalService<K extends keyof GlobalServices>(service: K): boolean {
		return this.#global[service] !== undefined;
	}

	/** ⚠️ If the service is not enabled, an error is raised. */
	global<K extends keyof GlobalServices>(service: K): NonNullable<GlobalServices[K]> {
		if (!this.hasGlobalService(service)) {
			throw new Error(`Attempted to get global service '${service}' that is not enabled.`);
		}

		return this.#global[service]!;
	}

	hasLocalService<K extends keyof LocalServices>(service: K, { guildId }: { guildId: bigint }): boolean {
		return this.#local[service].has(guildId);
	}

	/** ⚠️ If the service is not enabled on the given guild, an error is raised. */
	local<K extends keyof LocalServices>(service: K, { guildId }: { guildId: bigint }): LocalServices[K] {
		if (!this.hasLocalService(service, { guildId })) {
			throw new Error(
				`Attempted to get local service '${service}' that was not enabled on guild with ID ${guildId}.`,
			);
		}

		return this.#local[service].get(guildId)!;
	}
}

export { ServiceStore };
