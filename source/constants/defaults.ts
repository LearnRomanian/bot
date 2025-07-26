import type { TimeStruct } from "rost:constants/time";
import type { RateLimit } from "rost/models/guild";

const GUILD_SOURCE_LOCALE: Discord.Locale = "en-GB";
const GUILD_TARGET_LOCALE: Discord.Locale = "ro";

const COMMAND_RATE_LIMIT: RateLimit = { uses: 5, within: [10, "second"] };
const REPORT_RATE_LIMIT: RateLimit = { uses: 50, within: [1, "day"] };
const RESOURCE_RATE_LIMIT: RateLimit = { uses: 500, within: [1, "day"] };
const SUGGESTION_RATE_LIMIT: RateLimit = { uses: 50, within: [1, "day"] };
const TICKET_RATE_LIMIT: RateLimit = { uses: 10, within: [1, "day"] };
const PRAISE_RATE_LIMIT: RateLimit = { uses: 10, within: [1, "day"] };

const WARN_LIMIT = 3;
const WARN_EXPIRY: TimeStruct = [2, "month"];
const WARN_TIMEOUT: TimeStruct = [1, "day"];

const FLOOD_INTERVAL: TimeStruct = [5, "second"];
const FLOOD_MESSAGE_COUNT = 3;
const FLOOD_TIMEOUT: TimeStruct = [1, "day"];

const MUSIC_DISCONNECT_TIMEOUT: TimeStruct = [2, "minute"];

const MINIMUM_VOICE_CHANNELS = 0;
const MAXIMUM_VOICE_CHANNELS = 5;

export default Object.freeze({
	GUILD_SOURCE_LOCALE,
	GUILD_TARGET_LOCALE,
	COMMAND_RATE_LIMIT,
	REPORT_RATE_LIMIT,
	RESOURCE_RATE_LIMIT,
	TICKET_RATE_LIMIT,
	SUGGESTION_RATE_LIMIT,
	PRAISE_RATE_LIMIT,
	WARN_LIMIT,
	WARN_EXPIRY,
	WARN_TIMEOUT,
	FLOOD_INTERVAL,
	FLOOD_MESSAGE_COUNT,
	FLOOD_TIMEOUT,
	MUSIC_DISCONNECT_TIMEOUT,
	MINIMUM_VOICE_CHANNELS,
	MAXIMUM_VOICE_CHANNELS,
});
