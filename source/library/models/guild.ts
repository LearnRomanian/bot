import type { Client } from "rost/client";
// biome-ignore lint/nursery/noExportedImports: The re-export of `RateLimit` is okay for now.
import type { FeatureManagement, GuildDocument, RateLimit } from "rost/models/documents/guild";
import { type CreateModelOptions, GuildModel, type IdentifierData, Model } from "rost/models/model";
import type { DatabaseStore } from "rost/stores/database";

type CreateGuildOptions = CreateModelOptions<Guild, GuildDocument>;

interface Guild extends GuildDocument {}
class Guild extends GuildModel {
	readonly createdAt: number;

	get guildId(): string {
		return this.idParts[0];
	}

	constructor(
		database: DatabaseStore,
		{ createdAt, enabledFeatures, journalling, features, ...data }: CreateGuildOptions,
	) {
		super(database, data, { collection: "Guilds" });

		this.createdAt = createdAt ?? Date.now();
		this.enabledFeatures = enabledFeatures ?? {
			journalling: false,
			notices: false,
			informationNotices: false,
			resourceNotices: false,
			roleNotices: false,
			welcomeNotices: false,
			resources: false,
			targetOnly: false,
			alerts: false,
			policy: false,
			rules: false,
			purging: false,
			slowmode: false,
			timeouts: false,
			warns: false,
			reports: false,
			antiFlood: false,
			verification: false,
			dynamicVoiceChannels: false,
			entry: false,
			roleIndicators: false,
			suggestions: false,
			resourceSubmissions: false,
			tickets: false,
			music: false,
			praises: false,
			profile: false,
		};
		this.journalling = journalling ?? {
			purging: false,
			slowmode: false,
			timeouts: false,
			warns: false,
			reports: false,
			antiFlood: false,
			verification: false,
			suggestions: false,
			resourceSubmissions: false,
			tickets: false,
			praises: false,
		};
		this.features = features ?? {};
	}

	static async get(client: Client, data: IdentifierData<Guild>): Promise<Guild | undefined> {
		const partialId = Model.buildPartialId(data);
		if (client.documents.guilds.has(partialId)) {
			return client.documents.guilds.get(partialId)!;
		}

		return client.database.withSession((session) => {
			return session.get<Guild>(Model.buildId<Guild>(data, { collection: "Guilds" }));
		});
	}

	static async create(client: Client, data: CreateGuildOptions): Promise<Guild> {
		const guildDocument = await client.database.withSession((session) => {
			return session.set(new Guild(client.database, data));
		});

		return guildDocument;
	}

	static async getOrCreate(client: Client, data: CreateGuildOptions): Promise<Guild> {
		const guildDocument = await Guild.get(client, data);
		if (guildDocument !== undefined) {
			return guildDocument;
		}

		return Guild.create(client, data);
	}

	hasEnabled(feature: keyof Guild["enabledFeatures"]): boolean {
		return this.enabledFeatures[feature];
	}

	feature<K extends keyof Guild["features"]>(feature: K): NonNullable<Guild["features"][K]> {
		if (!this.hasEnabled(feature)) {
			throw new Error(
				`Attempted to get guild feature '${feature}' that was not enabled on guild with ID ${this.guildId}.`,
			);
		}

		const configuration = this.features[feature];
		if (configuration === undefined) {
			throw new Error(
				`Guild feature '${feature}' is enabled on guild with ID ${this.guildId}, but missing a configuration.`,
			);
		}

		return configuration;
	}

	isJournalled(feature: keyof Guild["journalling"]): boolean {
		return this.journalling[feature];
	}

	rateLimit(feature: keyof Guild["rateLimits"]): RateLimit | undefined {
		return this.rateLimits[feature];
	}

	managers(feature: keyof Guild["management"]): FeatureManagement | undefined {
		return this.management[feature];
	}

	isTargetLanguageOnlyChannel(channelId: string): boolean {
		if (!this.hasEnabled("targetOnly")) {
			return false;
		}

		return this.feature("targetOnly").channelIds.includes(channelId) ?? false;
	}
}

export { Guild };
export type { CreateGuildOptions, RateLimit };
