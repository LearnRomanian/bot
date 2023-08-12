import * as Discord from "discordeno";

const languages = {
	localisation: {
		discord: [
			"Dutch",
			"English/American",
			"English/British",
			"Finnish",
			"French",
			"German",
			"Greek",
			"Hungarian",
			"Norwegian/Bokmål",
			"Polish",
			"Romanian",
			"Turkish",
		],
		logos: ["Armenian/Western", "Armenian/Eastern"],
	},
	feature: [
		"Armenian",
		"Dutch",
		"English",
		"French",
		"German",
		"Greek",
		"Hungarian",
		"Norwegian",
		"Polish",
		"Romanian",
		"Turkish",
	],
} as const;

const languageToLocale = {
	discord: {
		Dutch: "nl",
		"English/American": "en-US",
		"English/British": "en-GB",
		Finnish: "fi",
		French: "fr",
		German: "de",
		Greek: "el",
		Hungarian: "hu",
		"Norwegian/Bokmål": "no",
		Polish: "pl",
		Romanian: "ro",
		Turkish: "tr",
	} satisfies Record<DiscordLanguage, Discord.Locale>,
	logos: {
		"Armenian/Eastern": "hye",
		"Armenian/Western": "hyw",
		Dutch: "nld",
		"English/American": "eng-US",
		"English/British": "eng-GB",
		Finnish: "fin",
		French: "fra",
		Greek: "ell",
		German: "deu",
		Hungarian: "hun",
		"Norwegian/Bokmål": "nob",
		Polish: "pol",
		Romanian: "ron",
		Turkish: "tur",
	} as const satisfies Record<LocalisationLanguage, string>,
} as const;

const localeToLanguage = {
	discord: reverseObject(languageToLocale.discord),
	logos: reverseObject(languageToLocale.logos),
} as const;

type DiscordLanguage = typeof languages.localisation.discord[number];
type LogosLanguage = typeof languages.localisation.logos[number];

type LocalisationLanguage = DiscordLanguage | LogosLanguage;
type FeatureLanguage = typeof languages.feature[number];
type LearningLanguage = LocalisationLanguage;

type DiscordLocale = typeof languageToLocale.discord[keyof typeof languageToLocale.discord];
type Locale = typeof languageToLocale.logos[keyof typeof languageToLocale.logos];

function getDiscordLocaleByLanguage(language: DiscordLanguage): DiscordLocale {
	return languageToLocale.discord[language];
}

function getLocaleByLanguage(language: LocalisationLanguage): Locale {
	return languageToLocale.logos[language];
}

function getDiscordLanguageByDiscordLocale(locale: string | undefined): DiscordLanguage | undefined {
	if (locale === undefined || !(locale in localeToLanguage.discord)) {
		return undefined;
	}

	return localeToLanguage.discord[locale as keyof typeof localeToLanguage.discord];
}

function getLanguageByLocale(locale: Locale): LocalisationLanguage {
	return localeToLanguage.logos[locale];
}

function isBuiltIn(language: string): language is DiscordLanguage {
	return (languages.localisation.discord as readonly string[]).includes(language);
}

function isLocalised(language: string): language is LocalisationLanguage {
	if (isBuiltIn(language)) {
		return true;
	}

	return (languages.localisation.logos as readonly string[]).includes(language);
}

function isFeatured(language: string): language is FeatureLanguage {
	return (languages.feature as readonly string[]).includes(language);
}

type Reverse<O extends Record<string, string>> = {
	[K in keyof O as O[K]]: K;
};
function reverseObject<O extends Record<string, string>>(object: O): Reverse<O> {
	const reversed: Partial<Reverse<O>> = {};
	for (const key of Object.keys(object) as (keyof O)[]) {
		// @ts-ignore: This is okay.
		reversed[object[key]] = key;
	}
	return reversed as unknown as Reverse<O>;
}

export default {
	localisation: [...languages.localisation.discord, ...languages.localisation.logos],
	feature: languages.feature,
};
export {
	getDiscordLocaleByLanguage,
	getLanguageByLocale,
	getDiscordLanguageByDiscordLocale,
	getLocaleByLanguage,
	isLocalised,
	isFeatured,
	isBuiltIn,
};
export type { LearningLanguage, FeatureLanguage, LocalisationLanguage, Locale };
