import { getLearningLocaleByLanguage } from "logos:constants/languages/learning";
import { isLocalisationLanguage } from "logos:constants/languages/localisation";
import { shuffle } from "ioredis/built/utils";
import type { Client } from "logos/client";
import { handleAutocompleteLanguage } from "logos/commands/fragments/autocomplete/language";
import type { SentencePair } from "logos/stores/volatile";

async function handleFindInContextAutocomplete(
	client: Client,
	interaction: Logos.Interaction<any, { language: string | undefined }>,
): Promise<void> {
	await handleAutocompleteLanguage(
		client,
		interaction,
		{ type: "localisation" },
		{ parameter: interaction.parameters.language },
	);
}

async function handleFindInContext(
	client: Client,
	interaction: Logos.Interaction<
		any,
		{ phrase: string; language: string | undefined; "case-sensitive": boolean | undefined }
	>,
): Promise<void> {
	if (interaction.parameters.language !== undefined && !isLocalisationLanguage(interaction.parameters.language)) {
		const strings = constants.contexts.invalidLanguage({ localise: client.localise, locale: interaction.locale });
		client.error(interaction, { title: strings.title, description: strings.description }).ignore();

		return;
	}

	await client.postponeReply(interaction, { visible: interaction.parameters.show });

	const learningLanguage = interaction.parameters.language ?? interaction.learningLanguage;
	const learningLocale = getLearningLocaleByLanguage(learningLanguage);

	const segmenter = new Intl.Segmenter(learningLocale, { granularity: "word" });
	const lemmas = Array.from(segmenter.segment(interaction.parameters.phrase))
		.filter((data) => data.isWordLike)
		.map((data) => data.segment);
	const lemmaUses = await client.volatile?.searchForLemmaUses({
		lemmas,
		learningLocale,
		caseSensitive: interaction.parameters["case-sensitive"],
	});
	if (lemmaUses === undefined || lemmaUses.sentencePairs.length === 0) {
		const strings = constants.contexts.noSentencesFound({
			localise: client.localise,
			locale: interaction.displayLocale,
		});
		client
			.warned(interaction, { title: strings.title, description: strings.description }, { autoDelete: true })
			.ignore();

		return;
	}

	shuffle(lemmaUses.sentencePairs);

	let sentencePairSelection: SentencePair[];
	if (lemmaUses.sentencePairs.length <= constants.SENTENCE_PAIRS_TO_SHOW) {
		sentencePairSelection = lemmaUses.sentencePairs;
	} else {
		sentencePairSelection = lemmaUses.sentencePairs.slice(0, constants.SENTENCE_PAIRS_TO_SHOW);
	}

	const lemmaPatterns = lemmaUses.lemmas.map<[lemma: string, pattern: RegExp]>((lemma) => [
		lemma,
		constants.patterns.wholeWord(lemma, { caseSensitive: true }),
	]);

	const strings = {
		...constants.contexts.language({ localise: client.localise, locale: interaction.displayLocale }),
		...constants.contexts.phraseInContext({ localise: client.localise, locale: interaction.displayLocale }),
	};
	client
		.noticed(interaction, {
			embeds: [
				{
					title: strings.title({ phrase: interaction.parameters.phrase }),
					fields: sentencePairSelection.map((sentencePair) => {
						let sentenceFormatted = sentencePair.sentence;
						for (const [lemma, pattern] of lemmaPatterns) {
							sentenceFormatted = sentenceFormatted.replaceAll(pattern, `__${lemma}__`);
						}

						return {
							name: sentenceFormatted,
							value: `> ${sentencePair.translation}`,
						};
					}),
					footer: { text: strings.language(learningLanguage) },
				},
			],
			components: interaction.parameters.show
				? undefined
				: [
						{
							type: Discord.MessageComponentTypes.ActionRow,
							components: [client.services.global("interactionRepetition").getShowButton(interaction)],
						},
					],
		})
		.ignore();
}

export { handleFindInContext, handleFindInContextAutocomplete };
