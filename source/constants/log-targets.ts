import directories from "rost:constants/directories";

export default Object.freeze({
	stdout: {
		feedback: {
			target: "pino-pretty",
			level: "debug",
			options: {
				ignore: "pid,hostname",
			},
		},
	},
	file: {
		debug: {
			target: "pino/file",
			level: "debug",
			options: { destination: `${directories.logs}/debug-log.os`, mkdir: true },
		},
		standard: {
			target: "pino/file",
			level: "info",
			options: { destination: `${directories.logs}/log.os`, mkdir: true },
		},
		discordeno: {
			target: "pino/file",
			level: "debug",
			options: {
				destination: `${directories.logs}/discordeno-log.os`,
				mkdir: true,
			},
		},
	},
} as const);
