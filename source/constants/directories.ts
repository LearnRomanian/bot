const directories = Object.freeze({
	assets: {
		localisations: "./assets/localisations",
	},
	logs: "./logs",
	migrations: "./database/migrations",
	plugins: "./plugins",
} as const);

export default directories;
