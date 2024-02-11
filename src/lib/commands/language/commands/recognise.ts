import * as Discord from "@discordeno/bot";
import constants from "../../../../constants/constants";
import { DetectionLanguage, Locale } from "../../../../constants/languages";
import localisations from "../../../../constants/localisations";
import { list } from "../../../../formatting";
import * as Logos from "../../../../types";
import { Client } from "../../../client";
import { editReply, parseArguments, postponeReply, reply } from "../../../interactions";
import { asStream } from "../../../utils";
import { CommandTemplate } from "../../command";
import { getAdapters } from "../detectors/adapters";

const commands = {
	chatInput: {
		id: "recognize",
		type: Discord.ApplicationCommandTypes.ChatInput,
		defaultMemberPermissions: ["VIEW_CHANNEL"],
		handle: handleRecogniseLanguageChatInput,
		options: [
			{
				id: "text",
				type: Discord.ApplicationCommandOptionTypes.String,
				required: true,
			},
		],
	},
	message: {
		id: "recognize.message",
		type: Discord.ApplicationCommandTypes.Message,
		defaultMemberPermissions: ["VIEW_CHANNEL"],
		handle: handleRecogniseLanguageMessage,
	},
} satisfies Record<string, CommandTemplate>;

async function handleRecogniseLanguageChatInput(client: Client, interaction: Logos.Interaction): Promise<void> {
	const [{ text }] = parseArguments(interaction.data?.options, {});
	if (text === undefined) {
		return;
	}

	const locale = interaction.locale;

	handleRecogniseLanguage(client, interaction, text, { isMessage: false }, { locale });
}

async function handleRecogniseLanguageMessage(client: Client, interaction: Logos.Interaction): Promise<void> {
	const locale = interaction.locale;

	const message = interaction.data?.resolved?.messages?.array()?.at(0);
	if (message === undefined) {
		return;
	}

	const hasEmbeds = message.embeds !== undefined && message.embeds.length !== 0;
	if (hasEmbeds) {
		const strings = {
			title: client.localise("recognize.strings.cannotUse.title", locale)(),
			description: client.localise("recognize.strings.cannotUse.description", locale)(),
		};

		reply(client, interaction, {
			embeds: [
				{
					title: strings.title,
					description: strings.description,
					color: constants.colors.dullYellow,
				},
			],
		});
		return;
	}

	const text = message.content;

	handleRecogniseLanguage(client, interaction, text, { isMessage: true }, { locale });
}

async function handleRecogniseLanguage(
	client: Client,
	interaction: Logos.Interaction,
	text: string,
	{ isMessage }: { isMessage: boolean },
	{ locale }: { locale: Locale },
): Promise<void> {
	const isTextEmpty = text.trim().length === 0;
	if (isTextEmpty) {
		const strings = {
			title: client.localise("recognize.strings.textEmpty.title", locale)(),
			description: client.localise("recognize.strings.textEmpty.description", locale)(),
		};

		reply(client, interaction, {
			embeds: [
				{
					title: strings.title,
					description: strings.description,
					color: constants.colors.dullYellow,
				},
			],
		});
		return;
	}

	await postponeReply(client, interaction);

	const detectedLanguages = await detectLanguages(text);

	if (detectedLanguages.likely.length === 0 && detectedLanguages.possible.length === 0) {
		const strings = {
			title: client.localise("recognize.strings.unknown.title", locale)(),
			description: {
				text: client.localise("recognize.strings.unknown.description.text", locale)(),
				message: client.localise("recognize.strings.unknown.description.message", locale)(),
			},
		};

		editReply(client, interaction, {
			embeds: [
				{
					title: strings.title,
					description: isMessage ? strings.description.message : strings.description.text,
					color: constants.colors.peach,
				},
			],
		});
		return;
	}

	const embeds: Discord.CamelizedDiscordEmbed[] = [];

	if (detectedLanguages.likely.length === 1 && detectedLanguages.possible.length === 0) {
		const language = detectedLanguages.likely.at(0) as DetectionLanguage | undefined;
		if (language === undefined) {
			throw "StateError: Detected language unexpectedly undefined.";
		}

		const strings = {
			description: client.localise(
				"recognize.strings.fields.likelyMatches.description.single",
				locale,
			)({ language: client.localise(localisations.languages[language], locale)() }),
		};

		embeds.push({
			description: strings.description,
			color: constants.colors.blue,
		});

		editReply(client, interaction, { embeds });
		return;
	}

	{
		const embed: Discord.CamelizedDiscordEmbed = {
			color: constants.colors.blue,
		};

		const fields: Discord.CamelizedDiscordEmbedField[] = [];

		if (detectedLanguages.likely.length === 1) {
			const language = detectedLanguages.likely.at(0) as DetectionLanguage | undefined;
			if (language === undefined) {
				throw "StateError: Likely detected language unexpectedly undefined.";
			}

			const languageNameLocalised = client.localise(localisations.languages[language], locale)();

			const strings = {
				title: client.localise("recognize.strings.fields.likelyMatches.title", locale)(),
				description: client.localise(
					"recognize.strings.fields.likelyMatches.description.single",
					locale,
				)({ language: `**${languageNameLocalised}**` }),
			};

			fields.push({
				name: `${constants.symbols.detect.likely} ${strings.title}`,
				value: strings.description,
				inline: false,
			});
		} else {
			const languageNamesLocalised = detectedLanguages.likely.map((language) =>
				client.localise(localisations.languages[language], locale)(),
			);
			const languageNamesFormatted = list(languageNamesLocalised.map((languageName) => `***${languageName}***`));

			const strings = {
				title: client.localise("recognize.strings.fields.likelyMatches.title", locale)(),
				description: client.localise("recognize.strings.fields.likelyMatches.description.multiple", locale)(),
			};

			fields.push({
				name: `${constants.symbols.detect.likely} ${strings.title}`,
				value: `${strings.description}\n${languageNamesFormatted}`,
				inline: false,
			});
		}

		if (detectedLanguages.possible.length === 1) {
			const language = detectedLanguages.possible.at(0) as DetectionLanguage | undefined;
			if (language === undefined) {
				throw "StateError: Possible detected language unexpectedly undefined.";
			}

			const languageNameLocalised = client.localise(localisations.languages[language], locale)();

			const strings = {
				title: client.localise("recognize.strings.fields.possibleMatches.title", locale)(),
				description: client.localise(
					"recognize.strings.fields.possibleMatches.description.single",
					locale,
				)({ language: `**${languageNameLocalised}**` }),
			};

			fields.push({
				name: `${constants.symbols.detect.possible} ${strings.title}`,
				value: strings.description,
				inline: false,
			});
		} else {
			const languageNamesLocalised = detectedLanguages.possible.map((language) =>
				client.localise(localisations.languages[language], locale)(),
			);
			const languageNamesFormatted = list(languageNamesLocalised.map((languageName) => `***${languageName}***`));

			const strings = {
				title: client.localise("recognize.strings.fields.possibleMatches.title", locale)(),
				description: client.localise("recognize.strings.fields.possibleMatches.description.multiple", locale)(),
			};

			fields.push({
				name: `${constants.symbols.detect.possible} ${strings.title}`,
				value: `${strings.description}\n${languageNamesFormatted}`,
				inline: false,
			});
		}

		embed.fields = fields;

		embeds.push(embed);
	}

	editReply(client, interaction, { embeds });
}

async function detectLanguages(text: string): Promise<DetectedLanguagesSorted> {
	const adapters = getAdapters();

	const detectionFrequencies: Partial<Record<DetectionLanguage, number>> = {};
	for await (const element of asStream(adapters, (adapter) => adapter.detect(text))) {
		if (element.result === undefined) {
			continue;
		}

		const detection = element.result;
		const detectedLanguage = detection.language;

		detectionFrequencies[detectedLanguage] = (detectionFrequencies[detectedLanguage] ?? 1) + 1;
	}

	const languagesSorted = getLanguagesSorted(detectionFrequencies);

	return languagesSorted;
}

type DetectedLanguagesSorted = {
	likely: DetectionLanguage[];
	possible: DetectionLanguage[];
};
function getLanguagesSorted(detectionFrequencies: Partial<Record<DetectionLanguage, number>>): DetectedLanguagesSorted {
	const entries = Object.entries(detectionFrequencies) as [DetectionLanguage, number][];

	let mode = 0;
	for (const [_, frequency] of entries) {
		if (frequency > mode) {
			mode = frequency;
		}
	}

	const likely = entries.filter(([_, frequency]) => frequency === mode).map(([language, _]) => language);
	const possible = entries.map(([language, _]) => language).filter((language) => !likely.includes(language));

	return { likely, possible };
}

export default commands;
export { detectLanguages };
