import type { OptionTemplate } from "rost/commands/commands";

export default Object.freeze({
	user: {
		identifier: "user",
		type: Discord.ApplicationCommandOptionTypes.String,
		required: true,
		autocomplete: true,
	},
	show: {
		identifier: "show",
		type: Discord.ApplicationCommandOptionTypes.Boolean,
	},
	duration: {
		identifier: "duration",
		type: Discord.ApplicationCommandOptionTypes.String,
		required: true,
		autocomplete: true,
	},
	reason: {
		identifier: "reason",
		type: Discord.ApplicationCommandOptionTypes.String,
		required: true,
	},
	query: {
		identifier: "query",
		type: Discord.ApplicationCommandOptionTypes.String,
		required: true,
	},
	timestamp: {
		identifier: "timestamp",
		type: Discord.ApplicationCommandOptionTypes.String,
		required: true,
		autocomplete: true,
	},
	collection: {
		identifier: "collection",
		type: Discord.ApplicationCommandOptionTypes.Boolean,
	},
	by: {
		identifier: "by",
		type: Discord.ApplicationCommandOptionTypes.Integer,
	},
	to: {
		identifier: "to",
		type: Discord.ApplicationCommandOptionTypes.Integer,
	},
} as const satisfies Record<string, OptionTemplate>);
