import fs from "node:fs/promises";
import type pino from "pino";

const decoder = new TextDecoder();

async function loadLocalisations({ log }: { log: pino.Logger }): Promise<Map<string, Map<Discord.Locale, string>>> {
	log = log.child({ name: "Localisations" });

	log.info("Loading localisations...");

	const directoryPaths: string[] = [];
	for (const entryPath of await fs.readdir(constants.directories.assets.localisations)) {
		const combinedPath = `${constants.directories.assets.localisations}/${entryPath}`;
		if (!(await fs.stat(combinedPath)).isDirectory()) {
			continue;
		}

		directoryPaths.push(combinedPath);
	}

	log.debug(`Detected ${directoryPaths.length} localisation director(y/ies). Reading...`);

	const localisationFiles: [locale: Discord.Locale, path: string, normalise: boolean][] = [];
	for (const directoryPath of directoryPaths) {
		const normalise = directoryPath.endsWith("/commands") || directoryPath.endsWith("/parameters");

		for (const entryPath of await fs.readdir(directoryPath)) {
			const combinedPath = `${directoryPath}/${entryPath}`;
			if (!(await fs.stat(combinedPath)).isFile()) {
				continue;
			}

			const [locale, _] = entryPath.split(".") as [Discord.Locale, string];
			if (locale === undefined) {
				continue;
			}

			localisationFiles.push([locale, combinedPath, normalise]);
		}
	}

	const localisations = new Map<string, Map<Discord.Locale, string>>();
	for (const [locale, path, normalise] of localisationFiles) {
		const strings = await fs
			.readFile(path)
			.then((contents) => decoder.decode(contents))
			.then((object) => JSON.parse(object) as Record<string, string>);

		for (const [key, value] of Object.entries(strings)) {
			if (!localisations.has(key)) {
				localisations.set(key, new Map());
			}

			if (normalise) {
				if (
					key.endsWith(".name") &&
					(value.includes(" ") || value.includes("/") || value.includes("'") || value.toLowerCase() !== value)
				) {
					if (!key.startsWith("parameters.") && key.endsWith("message.name")) {
						localisations.get(key)?.set(locale, value);
						continue;
					}

					log.warn(`${locale}: '${key}' is not normalised. Normalising...`);

					const valueNormalised = value
						.toLowerCase()
						.split(" ")
						.join("-")
						.replaceAll("/", "-")
						.replaceAll("'", "-");
					localisations.get(key)?.set(locale, valueNormalised);

					continue;
				}

				if (
					key.endsWith(".description") &&
					`${key.replace(constants.patterns.localisationDescription, ".name")}` in strings &&
					value.length > 100
				) {
					log.warn(`${locale}: '${key}' is too long (>100 characters). Normalising...`);

					const valueNormalised = value.slice(0, 100);
					localisations.get(key)?.set(locale, valueNormalised);

					continue;
				}
			}

			localisations.get(key)?.set(locale, value);
		}
	}

	const stringCount = Array.from(localisations.values())
		.flatMap((map) => map.values())
		.flat().length;

	log.info(`Loaded ${stringCount} strings.`);

	return localisations;
}

export { loadLocalisations };
