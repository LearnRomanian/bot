import commands from "rost:constants/emojis/commands";
import events from "rost:constants/emojis/events";
import roles from "rost:constants/emojis/roles";
import services from "rost:constants/emojis/services";

export default Object.freeze({
	commands,
	events,
	roles,
	services,
	verification: {
		for: "🟩",
		against: "🟥",
	},
	link: "🔗",
	source: "©️",
	interactions: {
		menu: {
			controls: {
				back: "←",
				forward: "→",
			},
		},
	},
	showInChat: "🗨️",
} as const);
