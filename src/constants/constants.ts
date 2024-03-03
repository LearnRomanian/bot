import acknowledgements from "./acknowledgements";
import colors from "./colors";
import components from "./components";
import contributions from "./contributions";
import defaults from "./defaults";
import endpoints from "./endpoints";
import gifs from "./gifs";
import languages from "./languages";
import links from "./links";
import patterns from "./patterns";
import properties from "./properties";
import statuses from "./statuses";
import symbols from "./symbols";
import time from "./time";

export default {
	INTERACTION_TOKEN_EXPIRY: 1000 * 60 * 15 - 1000 * 10, // 14 minutes, 50 seconds in milliseconds.
	SLOWMODE_COLLISION_TIMEOUT: 1000 * 20, // 20 seconds in milliseconds.
	MAXIMUM_CORRECTION_MESSAGE_LENGTH: 3072,
	MAXIMUM_USERNAME_LENGTH: 32,
	acknowledgements,
	colors,
	components,
	contributions,
	defaults,
	endpoints,
	gifs,
	languages,
	links,
	patterns,
	properties,
	statuses,
	symbols,
	time,
};
