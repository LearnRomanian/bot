import type constants_ from "rost:constants/constants";
import type { Locale } from "rost:constants/languages";
import type {
	DesiredProperties,
	DesiredPropertiesBehaviour,
	SelectedDesiredProperties,
} from "rost:constants/properties";
import type { SlowmodeLevel } from "rost:constants/slowmode";
import type { WithRequired } from "rost:core/utilities";
import type { EntryRequest } from "rost/models/entry-request";
import type { Praise } from "rost/models/praise";
import type { Report } from "rost/models/report";
import type { Resource } from "rost/models/resource";
import type { Suggestion } from "rost/models/suggestion";
import type { Ticket } from "rost/models/ticket";
import type { Warning } from "rost/models/warning";

declare global {
	interface Promise {
		/** Ignores the result of the promise. Useful in fire-and-forget situations. */
		ignore(): void;
	}

	interface Array<T> {
		/**
		 * Taking an array, splits it into parts of equal sizes.
		 *
		 * @param size - The size of each chunk.
		 * @returns The chunked array.
		 */
		toChunked(size: number): T[][];
	}
}

declare global {
	// biome-ignore lint/style/noNamespace: We use Rost types to make a distinction from Discordeno types.
	namespace Rost {
		type Guild = Discord.SetupDesiredProps<
			Omit<Discord.Guild, "roles" | "members" | "channels" | "voiceStates"> & {
				roles: Discord.Collection<bigint, Role>;
				members: Discord.Collection<bigint, Member>;
				channels: Discord.Collection<bigint, Channel>;
				voiceStates: Discord.Collection<bigint, VoiceState>;
			},
			SelectedDesiredProperties
		>;

		type RawInteraction = Discord.SetupDesiredProps<Discord.Interaction, SelectedDesiredProperties>;

		type Channel = Discord.SetupDesiredProps<Discord.Channel, SelectedDesiredProperties>;

		type User = Discord.SetupDesiredProps<Discord.User, SelectedDesiredProperties>;

		type Member = Discord.SetupDesiredProps<Discord.Member, SelectedDesiredProperties> & { user?: User };

		type Message = Discord.SetupDesiredProps<Discord.Message, SelectedDesiredProperties>;

		type Attachment = Discord.SetupDesiredProps<Discord.Attachment, SelectedDesiredProperties> &
			Discord.FileContent;

		type Role = Discord.SetupDesiredProps<Discord.Role, SelectedDesiredProperties>;

		type VoiceState = Discord.SetupDesiredProps<Discord.VoiceState, SelectedDesiredProperties>;

		interface InteractionLocaleData {
			// Localisation
			locale: Locale;
			guildLocale: Locale;
			displayLocale: Locale;
		}

		type InteractionParameters<Parameters> = Parameters & {
			"@repeat": boolean;
			show: boolean;
			focused?: keyof Parameters;
		};

		type Interaction<
			Metadata extends string[] = any,
			Parameters extends Record<string, string | number | boolean | undefined> = any,
		> = WithRequired<
			Omit<RawInteraction, "locale" | "guildLocale" | "respond" | "edit" | "deferEdit" | "defer" | "delete">,
			"guildId" | "channelId"
		> &
			InteractionLocaleData & {
				commandName: string;
				metadata: [customId: string, ...data: Metadata];
				parameters: InteractionParameters<Parameters>;
			};

		/** Type representing events that occur within a guild. */
		type Events = {
			/** Fill-in Discord event for a member having been kicked. */
			guildMemberKick: [user: Rost.User, by: Rost.Member];
		} & {
			/** An entry request has been submitted. */
			entryRequestSubmit: [user: Rost.User, entryRequest: EntryRequest];

			/** An entry request has been accepted. */
			entryRequestAccept: [user: Rost.User, by: Rost.Member];

			/** An entry request has been rejected. */
			entryRequestReject: [user: Rost.User, by: Rost.Member];

			/** A member has been warned. */
			memberWarnAdd: [member: Rost.Member, warning: Warning, by: Rost.User];

			/** A member has had a warning removed from their account. */
			memberWarnRemove: [member: Rost.Member, warning: Warning, by: Rost.User];

			/** A member has been timed out. */
			memberTimeoutAdd: [member: Rost.Member, until: number, reason: string, by: Rost.User];

			/** A member's timeout has been cleared. */
			memberTimeoutRemove: [member: Rost.Member, by: Rost.User];

			/** A member has been praised. */
			praiseAdd: [member: Rost.Member, praise: Praise, by: Rost.User];

			/** A report has been submitted. */
			reportSubmit: [author: Rost.Member, report: Report];

			/** A resource has been submitted. */
			resourceSend: [member: Rost.Member, resource: Resource];

			/** A suggestion has been made. */
			suggestionSend: [member: Rost.Member, suggestion: Suggestion];

			/** A ticket has been opened. */
			ticketOpen: [member: Rost.Member, ticket: Ticket];

			/** An inquiry has been opened. */
			inquiryOpen: [member: Rost.Member, ticket: Ticket];

			/** A purging of messages has been initiated. */
			purgeBegin: [member: Rost.Member, channel: Rost.Channel, messageCount: number, author?: Rost.User];

			/** A purging of messages is complete. */
			purgeEnd: [member: Rost.Member, channel: Rost.Channel, messageCount: number, author?: Rost.User];

			/** A user has enabled slowmode in a channel. */
			slowmodeEnable: [user: Rost.User, channel: Rost.Channel, level: SlowmodeLevel];

			/** A user has disabled slowmode in a channel. */
			slowmodeDisable: [user: Rost.User, channel: Rost.Channel];

			/** A user has upgraded the slowmode level in a channel. */
			slowmodeUpgrade: [
				user: Rost.User,
				channel: Rost.Channel,
				previousLevel: SlowmodeLevel,
				currentLevel: SlowmodeLevel,
			];

			/** A user has downgraded the slowmode level in a channel. */
			slowmodeDowngrade: [
				user: Rost.User,
				channel: Rost.Channel,
				previousLevel: SlowmodeLevel,
				currentLevel: SlowmodeLevel,
			];
		};
	}

	const constants: typeof constants_;
}

declare global {
	// biome-ignore lint/performance/noReExportAll: This is fine because we need these types under the `Discord` namespace.
	export * as Discord from "@discordeno/bot";
}

declare module "@discordeno/bot" {
	type Locale = `${Discord.Locales}`;
	type VoiceServerUpdate = Parameters<
		Discord.EventHandlers<DesiredProperties, DesiredPropertiesBehaviour>["voiceServerUpdate"]
	>[0];
	type DeletedMessage = Discord.Events["messageDelete"][0];

	type Events = {
		[T in keyof Discord.EventHandlers<DesiredProperties, DesiredPropertiesBehaviour>]: Parameters<
			Discord.EventHandlers<DesiredProperties, DesiredPropertiesBehaviour>[T]
		>;
	};
}
