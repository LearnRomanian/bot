import acknowledgements from "rost:constants/acknowledgements";
import colours from "rost:constants/colours";
import components from "rost:constants/components";
import contexts from "rost:constants/contexts";
import contributions from "rost:constants/contributions";
import database from "rost:constants/database";
import defaults from "rost:constants/defaults";
import directories from "rost:constants/directories";
import discord from "rost:constants/discord";
import emojis from "rost:constants/emojis";
import gifs from "rost:constants/gifs";
import lengths from "rost:constants/lengths";
import links from "rost:constants/links";
import localisations from "rost:constants/localisations";
import logTargets from "rost:constants/log-targets";
import loggers from "rost:constants/loggers";
import parameters from "rost:constants/parameters";
import patterns from "rost:constants/patterns";
import properties from "rost:constants/properties";
import roles from "rost:constants/roles";
import rules from "rost:constants/rules";
import slowmode from "rost:constants/slowmode";
import special from "rost:constants/special";
import time from "rost:constants/time";

const constants = Object.freeze({
	PROJECT_NAME: "Rost",
	USER_AGENT: "Rost (https://github.com/LearnRomanian/rost)",
	TEST_GUILD_TEMPLATE_CODE: "JKjeApUwbege",
	TEST_GUILD_NAME: "Letter Development",
	TEST_GUILD_ICON_URL: Discord.guildIconUrl(1398666720591216691n, "f102fdd545452755d4ee78327b714fc2", {
		format: "png",
		size: 1024,
	}),
	BASE_LOCALE: "en-GB",
	STATUS_MESSAGE: "Managing 🇷🇴 Learn Romanian",
	MAXIMUM_DELETABLE_MESSAGES: 512,
	MAXIMUM_INDEXABLE_MESSAGES: 1024,
	MAXIMUM_CORRECTION_MESSAGE_LENGTH: 3072,
	MAXIMUM_VOLUME: 100,
	MAXIMUM_HISTORY_ENTRIES: 100,
	MAXIMUM_QUEUE_ENTRIES: 100,
	RESULTS_PER_PAGE: 10,
	SLOWMODE_COLLISION_TIMEOUT: 5 * time.second,
	AUTO_DELETE_MESSAGE_TIMEOUT: 10 * time.second,
} as const);

export default Object.freeze({
	...constants,
	acknowledgements,
	colours,
	components,
	contexts,
	contributions,
	database,
	defaults,
	directories,
	discord,
	emojis,
	gifs,
	lengths,
	links,
	localisations,
	logTargets,
	loggers,
	parameters,
	patterns,
	properties,
	roles,
	rules,
	slowmode,
	special,
	time,
});
