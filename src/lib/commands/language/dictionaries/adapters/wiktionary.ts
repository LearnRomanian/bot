import constants from "../../../../../constants/constants";
import languages, { LearningLanguage, Locale } from "../../../../../constants/languages";
import licences from "../../../../../constants/licences";
import defaults from "../../../../../defaults";
import { Client } from "../../../../client";
import { getPartOfSpeech } from "../../module";
import { DictionaryAdapter, DictionaryEntry } from "../adapter";
import { WiktionaryParser } from "wiktionary";

const wiktionary = new WiktionaryParser();

type WordData = ReturnType<typeof wiktionary["parse"]> extends Promise<(infer U)[]> ? U : never;

const newlinesExpression = RegExp("\n{1}", "g");

class WiktionaryAdapter extends DictionaryAdapter<WordData[]> {
	constructor() {
		super({
			name: "Wiktionary",
			supports: languages.localisation,
			provides: ["definitions", "etymology"],
		});
	}

	async fetch(lemma: string, language: LearningLanguage): Promise<WordData[] | undefined> {
		const data = await wiktionary.parse(lemma, language);
		if (data.length === 0) {
			// @ts-ignore: Accessing private member.
			const suggestion = wiktionary.document.getElementById("did-you-mean")?.innerText ?? undefined;
			if (suggestion === undefined) {
				return undefined;
			}

			return this.fetch(suggestion, language);
		}

		return data;
	}

	parse(
		lemma: string,
		language: LearningLanguage,
		results: WordData[],
		_: Client,
		__: { locale: Locale },
	): DictionaryEntry[] {
		const entries: DictionaryEntry[] = [];
		for (const result of results) {
			for (const definition of result.definitions) {
				const partOfSpeech = getPartOfSpeech(
					definition.partOfSpeech,
					definition.partOfSpeech,
					defaults.LOCALISATION_LANGUAGE,
				);
				const [_, ...definitions] = definition.text as [string, ...string[]];

				entries.push({
					lemma: lemma,
					title: "title",
					partOfSpeech,
					definitions: definitions.map((definition) => ({ value: definition })),
					etymologies: [{ value: result.etymology.replaceAll(newlinesExpression, "\n\n") }],
					sources: [
						[constants.links.generateWiktionaryDefinitionLink(lemma, language), licences.dictionaries.wiktionary],
					],
				});
			}
		}
		return entries;
	}
}

const adapter = new WiktionaryAdapter();

export default adapter;
