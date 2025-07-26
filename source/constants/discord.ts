import time from "rost:constants/time";

export default Object.freeze({
	// The 10 seconds are to account for potential network lag.
	INTERACTION_TOKEN_EXPIRY: 15 * time.minute - 10 * time.second,
	MAXIMUM_USERNAME_LENGTH: 32,
	MAXIMUM_EMBED_FIELD_LENGTH: 1024,
	MAXIMUM_EMBED_DESCRIPTION_LENGTH: 3072,
	MAXIMUM_AUTOCOMPLETE_CHOICES: 25,
} as const);
