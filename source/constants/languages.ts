import type { DetectionLanguage } from "logos:constants/languages/detection";
import { type FeatureLanguage, isFeatureLanguage } from "logos:constants/languages/feature";
import type { LearningLanguage } from "logos:constants/languages/learning";
import {
	type DiscordLocale,
	type LocalisationLanguage,
	languageToLocale as localisationLanguageToLocale,
	languages as localisationLanguages,
} from "logos:constants/languages/localisation";
import {
	type TranslationLanguage,
	isTranslationLanguage,
	languages as translationLanguages,
} from "logos:constants/languages/translation";

const languages = Object.freeze({
	languages: {
		localisation: [
			...new Set<LocalisationLanguage>([...localisationLanguages.discord, ...localisationLanguages.logos]),
		].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })),
		translation: [
			...new Set<TranslationLanguage>([...translationLanguages.deepl, ...translationLanguages.google]),
		].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })),
	},
	locales: {
		discord: Object.values(localisationLanguageToLocale.discord) as DiscordLocale[],
	},
});

const translationLanguagesByBaseLanguage = Object.freeze(
	languages.languages.translation.reduce<Record<string, TranslationLanguage[]>>((languages, language) => {
		const baseLanguage = getBaseLanguage(language);

		if (baseLanguage === language) {
			return languages;
		}

		if (baseLanguage in languages) {
			languages[baseLanguage]?.push(language);
		} else {
			languages[baseLanguage] = [language];
		}

		return languages;
	}, {}),
);

type Language = DetectionLanguage | FeatureLanguage | LearningLanguage | LocalisationLanguage | TranslationLanguage;
type BaseLanguage<Language> = Language extends `${infer BaseLanguage}/${string}` ? BaseLanguage : Language;
type WithBaseLanguage<Language> = Language extends BaseLanguage<Language> ? never : Language;

function getBaseLanguage<L extends Language>(language: L): BaseLanguage<L> {
	const baseLanguage = language.split("/").at(0)!;
	return baseLanguage as BaseLanguage<L>;
}

function getTranslationLanguage(language: Language): TranslationLanguage | undefined {
	if (isTranslationLanguage(language)) {
		return language;
	}

	const baseLanguage = getBaseLanguage(language);
	const otherVariants = translationLanguagesByBaseLanguage[baseLanguage];
	if (otherVariants === undefined) {
		return undefined;
	}

	const otherVariant = otherVariants.at(0);
	if (otherVariant === undefined) {
		return undefined;
	}

	return otherVariant;
}

interface Languages<Language extends string> {
	source: Language;
	target: Language;
}

export default languages;
export { getTranslationLanguage, getBaseLanguage };
export type { Language, Languages, WithBaseLanguage };
