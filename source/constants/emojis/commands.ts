export default Object.freeze({
	information: {
		bot: {
			features: {
				bot: "🤖",
				function: "🛠️",
				information: "ℹ️",
				moderation: "💢",
				roles: "💼",
				music: "🎶",
				social: "💐",
			},
		},
		guild: {
			description: "🖋️",
			members: "🧑",
			created: "⏱️",
			channels: {
				channels: "🗯️",
				text: "📜",
				voice: "🔊",
			},
			moderators: "⚖️",
			proficiencyDistribution: "🎓",
		},
	},
	profile: {
		roles: {
			directory: "➜",
		},
		view: {
			roles: "💼",
			statistics: "🧮",
			praises: "🙏",
			warnings: "😖",
		},
	},
	music: {
		song: "🎵",
		collection: "🎶",
		stream: "📁",
		list: "📋",
		loopEnabled: "🔁",
		loopDisabled: "⏸️",
		paused: "⏸️",
		queued: "👍",
		nowPlaying: "⬇️",
		replaying: "🔁",
		removed: "❌",
		resumed: "▶️",
		skippedTo: "🔍",
		skipped: "⏭️",
		fastForwarded: "⏩",
		rewound: "⏪",
		stopped: "⏹️",
		unskipped: "⏮️",
		volume: "🔊",
	},
	praise: {
		madeBy: "➜",
	},
} as const);
