export default Object.freeze({
	interaction: {
		// Acts as a delimeter for pieces of metadata encoded into an interaction custom ID.
		separator: "|",
		divider: "/",
	},
	database: {
		separator: "/",
	},
	sigils: {
		divider: "﹘",
		separator: "・",
		channelSeparator: "︲",
	},
	bullet: "-",
	strings: {
		trail: "...",
		continued: "(...)",
	},
	missingString: "?",
	roles: {
		back: "..",
	},
} as const);
