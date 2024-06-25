import { getLocaleByLearningLanguage, isLocalisationLanguage } from "logos:constants/languages.ts";
import { shuffle } from "ioredis/built/utils";
import type { Client } from "logos/client.ts";
import { autocompleteLanguage } from "logos/commands/fragments/autocomplete/language.ts";
import type { SentencePair } from "logos/stores/volatile.ts";

async function handleFindInContextAutocomplete(
	client: Client,
	interaction: Logos.Interaction<any, { language: string | undefined }>,
): Promise<void> {
	await autocompleteLanguage(client, interaction);
}

async function handleFindInContext(
	client: Client,
	interaction: Logos.Interaction<any, { phrase: string; language: string | undefined }>,
): Promise<void> {
	if (interaction.parameters.language !== undefined && !isLocalisationLanguage(interaction.parameters.language)) {
		const strings = constants.contexts.invalidLanguage({ localise: client.localise, locale: interaction.locale });
		await client.reply(interaction, {
			embeds: [
				{
					title: strings.title,
					description: strings.description,
					color: constants.colours.red,
				},
			],
		});
		return;
	}

	const learningLanguage =
		interaction.parameters.language !== undefined ? interaction.parameters.language : interaction.learningLanguage;
	const learningLocale = getLocaleByLearningLanguage(learningLanguage);

	await client.postponeReply(interaction, { visible: interaction.parameters.show });

	const sentencePairs = await client.volatile?.searchForPhrase({
		phrase: interaction.parameters.phrase,
		learningLocale: learningLocale,
	});
	if (sentencePairs === undefined || sentencePairs.length === 0) {
		const strings = constants.contexts.noSentencesFound({
			localise: client.localise.bind(client),
			locale: interaction.displayLocale,
		});
		await client.warned(
			interaction,
			{
				title: strings.title,
				description: strings.description,
			},
			{ autoDelete: true },
		);

		return;
	}

	let sentencePairSelection: SentencePair[];
	if (sentencePairs.length <= constants.SENTENCE_PAIRS_TO_SHOW) {
		sentencePairSelection = sentencePairs;
	} else {
		sentencePairSelection = shuffle(sentencePairs).slice(0, constants.SENTENCE_PAIRS_TO_SHOW);
	}

	const phrasePattern = constants.patterns.wholeWord(interaction.parameters.phrase);

	const strings = constants.contexts.phraseInContext({
		localise: client.localise.bind(client),
		locale: interaction.displayLocale,
	});
	await client.noticed(interaction, {
		embeds: [
			{
				title: strings.title({ phrase: interaction.parameters.phrase }),
				fields: sentencePairSelection.map((sentencePair) => ({
					name: sentencePair.sentence.replaceAll(phrasePattern, `__${interaction.parameters.phrase}__`),
					value: sentencePair.translation,
				})),
			},
		],
		components: interaction.parameters.show
			? undefined
			: [
					{
						type: Discord.MessageComponentTypes.ActionRow,
						components: [client.interactionRepetitionService.getShowButton(interaction)],
					},
				],
	});
}

export { handleFindInContext, handleFindInContextAutocomplete };
