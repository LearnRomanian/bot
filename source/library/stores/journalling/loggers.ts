import type { PromiseOr } from "rost:core/utilities";
import type { Client } from "rost/client";
import guildBanAdd from "rost/stores/journalling/discord/guild-ban-add";
import guildBanRemove from "rost/stores/journalling/discord/guild-ban-remove";
import guildMemberAdd from "rost/stores/journalling/discord/guild-member-add";
import guildMemberRemove from "rost/stores/journalling/discord/guild-member-remove";
import messageDelete from "rost/stores/journalling/discord/message-delete";
import messageDeleteBulk from "rost/stores/journalling/discord/message-delete-bulk";
import messageUpdate from "rost/stores/journalling/discord/message-update";
import entryRequestAccept from "rost/stores/journalling/rost/entry-request-accept";
import entryRequestReject from "rost/stores/journalling/rost/entry-request-reject";
import entryRequestSubmit from "rost/stores/journalling/rost/entry-request-submit";
import guildMemberKick from "rost/stores/journalling/rost/guild-member-kick";
import inquiryOpen from "rost/stores/journalling/rost/inquiry-open";
import memberTimeoutAdd from "rost/stores/journalling/rost/member-timeout-add";
import memberTimeoutRemove from "rost/stores/journalling/rost/member-timeout-remove";
import memberWarnAdd from "rost/stores/journalling/rost/member-warn-add";
import memberWarnRemove from "rost/stores/journalling/rost/member-warn-remove";
import praiseAdd from "rost/stores/journalling/rost/praise-add";
import purgeBegin from "rost/stores/journalling/rost/purge-begin";
import purgeEnd from "rost/stores/journalling/rost/purge-end";
import reportSubmit from "rost/stores/journalling/rost/report-submit";
import resourceSend from "rost/stores/journalling/rost/resource-send";
import slowmodeDisable from "rost/stores/journalling/rost/slowmode-disable";
import slowmodeDowngrade from "rost/stores/journalling/rost/slowmode-downgrade";
import slowmodeEnable from "rost/stores/journalling/rost/slowmode-enable";
import slowmodeUpgrade from "rost/stores/journalling/rost/slowmode-upgrade";
import suggestionSend from "rost/stores/journalling/rost/suggestion-send";
import ticketOpen from "rost/stores/journalling/rost/ticket-open";

type Events = Rost.Events & Discord.Events;

const loggers: EventLoggers = Object.freeze({
	guildBanAdd,
	guildBanRemove,
	guildMemberAdd,
	guildMemberRemove,
	messageDelete,
	messageDeleteBulk,
	messageUpdate,
	guildMemberKick,
	entryRequestSubmit,
	entryRequestAccept,
	entryRequestReject,
	memberWarnAdd,
	memberWarnRemove,
	memberTimeoutAdd,
	memberTimeoutRemove,
	praiseAdd,
	reportSubmit,
	resourceSend,
	suggestionSend,
	ticketOpen,
	inquiryOpen,
	purgeBegin,
	purgeEnd,
	slowmodeEnable,
	slowmodeDisable,
	slowmodeUpgrade,
	slowmodeDowngrade,
} as const);

type EventLoggers = { [Event in keyof Events]?: EventLogger<Event> };
type EventLogger<Event extends keyof Events> = (
	client: Client,
	event: Events[Event],
	{ guildLocale }: { guildLocale: Discord.Locale },
) => PromiseOr<Discord.CreateMessageOptions | undefined>;

export default loggers;
export type { EventLogger, EventLoggers };
