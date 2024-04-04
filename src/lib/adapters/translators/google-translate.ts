import {
	GoogleTranslateLanguage,
	Languages,
	TranslationLocale,
	getGoogleTranslateLocaleByTranslationLanguage,
} from "logos:constants/languages";
import { getGoogleTranslateLanguageByLocale, isGoogleTranslateLocale } from "logos:constants/languages/translation";
import { Client } from "logos/client";
import { TranslationResult, TranslatorAdapter } from "logos/adapters/translators/adapter";

interface GoogleTranslationResult {
	data: {
		translations: {
			detectedSourceLanguage?: string;
			translatedText: string;
		}[];
	};
}

class GoogleTranslateAdapter extends TranslatorAdapter<GoogleTranslateLanguage> {
	constructor(client: Client) {
		super(client, { identifier: "GoogleTranslate" });
	}

	async translate({
		text,
		languages,
	}: { text: string; languages: Languages<GoogleTranslateLanguage> }): Promise<TranslationResult | undefined> {
		const sourceLocale = getGoogleTranslateLocaleByTranslationLanguage(languages.source);
		const targetLocale = getGoogleTranslateLocaleByTranslationLanguage(languages.target);

		const locales: Languages<TranslationLocale> = { source: sourceLocale, target: targetLocale };

		let response: Response;
		try {
			response = await fetch(constants.endpoints.googleTranslate.translate, {
				method: "POST",
				headers: {
					"User-Agent": constants.USER_AGENT,
					"Content-Type": "application/x-www-form-urlencoded",
					"X-RapidAPI-Key": this.client.environment.rapidApiSecret,
					"X-RapidAPI-Host": constants.endpoints.googleTranslate.host,
				},
				body: new URLSearchParams({ source: locales.source, target: locales.target, q: text, format: "text" }),
			});
		} catch (exception) {
			this.client.log.error(`The request to translate text of length ${text.length} failed:`, exception);
			return undefined;
		}

		if (!response.ok) {
			return undefined;
		}

		let result: GoogleTranslationResult;
		try {
			result = (await response.json()) as GoogleTranslationResult;
		} catch (exception) {
			this.client.log.error("Reading response data for text translation failed:", exception);
			return undefined;
		}

		const translation = result.data.translations?.at(0);
		if (translation === undefined) {
			return undefined;
		}

		const { detectedSourceLanguage: detectedSourceLocale, translatedText } = translation;
		if (translatedText === undefined) {
			return undefined;
		}

		const detectedSourceLanguage =
			detectedSourceLocale === undefined || !isGoogleTranslateLocale(detectedSourceLocale)
				? undefined
				: getGoogleTranslateLanguageByLocale(detectedSourceLocale);

		return { detectedSourceLanguage, text: translatedText };
	}
}

export { GoogleTranslateAdapter };
