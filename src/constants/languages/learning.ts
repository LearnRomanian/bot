import {
	Language as LocalisationLanguage,
	Locale,
	getLogosLocaleByLanguage as getLocaleByLocalisationLanguage,
	isLogosLanguage as isLocalisationLanguage,
	isLogosLocale as isLocalisationLocale,
} from "./localisation";

type Language = LocalisationLanguage;

function isLanguage(language: string): language is Language {
	return isLocalisationLanguage(language);
}

function isLocale(locale: string): locale is Locale {
	return isLocalisationLocale(locale);
}

function getLocaleByLanguage(language: Language): Locale {
	return getLocaleByLocalisationLanguage(language);
}

export { getLocaleByLanguage, isLanguage, isLocale };
export type { Language };
