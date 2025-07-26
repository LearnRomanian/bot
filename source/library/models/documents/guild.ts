import type { TimeStruct } from "rost:constants/time";

interface GuildDocument {
	createdAt: number;
	locales: {
		source: Discord.Locale;
		target: Discord.Locale;
	};
	enabledFeatures: {
		journalling: boolean;
		notices: boolean;
		informationNotices: boolean;
		resourceNotices: boolean;
		roleNotices: boolean;
		welcomeNotices: boolean;
		resources: boolean;
		targetOnly: boolean;
		alerts: boolean;
		policy: boolean;
		rules: boolean;
		purging: boolean;
		slowmode: boolean;
		timeouts: boolean;
		warns: boolean;
		reports: boolean;
		antiFlood: boolean;
		verification: boolean;
		dynamicVoiceChannels: boolean;
		entry: boolean;
		roleIndicators: boolean;
		suggestions: boolean;
		resourceSubmissions: boolean;
		tickets: boolean;
		music: boolean;
		praises: boolean;
		profile: boolean;
	};
	journalling: {
		purging: boolean;
		slowmode: boolean;
		timeouts: boolean;
		warns: boolean;
		reports: boolean;
		antiFlood: boolean;
		verification: boolean;
		suggestions: boolean;
		resourceSubmissions: boolean;
		tickets: boolean;
		praises: boolean;
	};
	rateLimits: {
		reports?: RateLimit;
		suggestions?: RateLimit;
		resourceSubmissions?: RateLimit;
		tickets?: RateLimit;
		praises?: RateLimit;
	};
	management: {
		reports?: FeatureManagement;
		verification?: FeatureManagement;
		suggestions?: FeatureManagement;
		resourceSubmissions?: FeatureManagement;
		tickets?: FeatureManagement;
	};
	features: {
		journalling?: {
			channelId: string;
		};
		informationNotices?: {
			channelId: string;
			inviteLink: string;
		};
		/** Relies on guild.features.language.features.resources.url */
		resourceNotices?: {
			channelId: string;
		};
		roleNotices?: {
			channelId: string;
		};
		welcomeNotices?: {
			channelId: string;
			ruleChannelId: string;
		};
		resources?: {
			url: string;
		};
		targetOnly?: {
			channelIds: string[];
		};
		alerts?: {
			channelId: string;
		};
		warns?: {
			expiration?: TimeStruct;
			limit: number;
			autoTimeout?: {
				duration: TimeStruct;
			};
		};
		reports?: {
			channelId: string;
		};
		antiFlood?: {
			interval?: TimeStruct;
			messageCount?: number;
			timeoutDuration?: TimeStruct;
		};
		/** Relies on guild.features.server.tickets.categoryId */
		verification?: {
			channelId: string;
			voting: {
				roles: string[];
				users?: string[];
				verdict: {
					acceptance: { type: "fraction" | "number"; value: number };
					rejection: { type: "fraction" | "number"; value: number };
				};
			};
			activation: {
				type: "account-age";
				value: TimeStruct;
			}[];
		};
		dynamicVoiceChannels?: {
			channels: DynamicVoiceChannel[];
		};
		roleIndicators?: {
			limit: number;
			roles: RoleWithIndicator[];
		};
		suggestions?: {
			channelId: string;
		};
		resourceSubmissions?: {
			channelId: string;
		};
		tickets?: {
			channelId: string;
			categoryId: string;
			limit?: number;
		};
		music?: {
			implicitVolume: number;
		};
	};
}

interface RateLimit {
	uses: number;
	within: TimeStruct;
}

interface FeatureManagement {
	roles?: string[];
	users?: string[];
}

interface DynamicVoiceChannel {
	id: string;
	minimum?: number;
	maximum?: number;
}

interface RoleWithIndicator {
	roleId: string;
	indicator: string;
}

export type { GuildDocument, DynamicVoiceChannel, RoleWithIndicator, RateLimit, FeatureManagement };
