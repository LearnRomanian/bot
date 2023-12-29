import * as Discord from "@discordeno/bot";
import constants from "../../../../constants/constants";
import { Locale, getLocaleByLearningLanguage } from "../../../../constants/languages";
import licences from "../../../../constants/licences";
import defaults from "../../../../defaults";
import * as Logos from "../../../../types";
import { Client, localise } from "../../../client";
import * as levenshtein from "fastest-levenshtein";
import {
	acknowledge,
	createInteractionCollector,
	decodeId,
	deleteReply,
	editReply,
	encodeId,
	postponeReply,
	reply,
} from "../../../interactions";
import { random } from "../../../utils";
import { CommandTemplate } from "../../command";
import { capitalise } from "../../../../formatting";
import { User } from "../../../database/user";

const command: CommandTemplate = {
	name: "game",
	type: Discord.ApplicationCommandTypes.ChatInput,
	defaultMemberPermissions: ["VIEW_CHANNEL"],
	handle: handleStartGame,
};

const wordSegmenter = new Intl.Segmenter(undefined, { granularity: "word" });

type WordButtonID = [index: string];

interface GameData {
	sentenceSelection: SentenceSelection;
	embedColour: number;
	customId: string;
	skipButtonCustomId: string;
	sessionScore: number;
}

/** Starts a simple game of 'choose the correct word to fit in the blank'. */
async function handleStartGame([client, bot]: [Client, Discord.Bot], interaction: Logos.Interaction): Promise<void> {
	const locale = interaction.locale;
	const learningLocale = getLocaleByLearningLanguage(interaction.learningLanguage);

	const guildId = interaction.guildId;
	if (guildId === undefined) {
		return;
	}

	const sentencePairCount = await client.cache.database.scard(`${learningLocale}:index`);
	if (sentencePairCount === 0) {
		const strings = {
			title: localise(client, "game.strings.noSentencesAvailable.title", locale)(),
			description: localise(client, "game.strings.noSentencesAvailable.description", locale)(),
		};

		await reply([client, bot], interaction, {
			embeds: [
				{
					title: strings.title,
					description: strings.description,
					color: constants.colors.dullYellow,
				},
			],
		});

		setTimeout(
			() =>
				deleteReply([client, bot], interaction).catch(() => {
					client.log.warn(`Failed to delete "no results for word" message.`);
				}),
			defaults.WARN_MESSAGE_DELETE_TIMEOUT,
		);

		return;
	}

	const session = client.database.openSession();

	const userDocument =
		client.cache.documents.users.get(interaction.user.id.toString()) ??
		(await session.load<User>(`users/${interaction.user.id}`).then((value) => value ?? undefined)) ??
		(await (async () => {
			const userDocument = {
				...({
					id: `users/${interaction.user.id}`,
					account: { id: interaction.user.id.toString() },
					createdAt: Date.now(),
				} satisfies User),
				"@metadata": { "@collection": "Users" },
			};
			await session.store(userDocument);
			await session.saveChanges();

			return userDocument as User;
		})());

	const guildStatsDocument = client.cache.documents.guildStats.get(guildId.toString());
	if (guildStatsDocument === undefined) {
		session.dispose();
		return;
	}

	const stats = guildStatsDocument.stats;
	if (stats === undefined) {
		guildStatsDocument.stats = {
			[learningLocale]: { pickMissingWord: { totalSessions: 1, totalScore: 0, uniquePlayers: 1 } },
		};
	} else {
		const statsForLanguage = stats[learningLocale];
		if (statsForLanguage === undefined) {
			stats[learningLocale] = { pickMissingWord: { totalSessions: 1, totalScore: 0, uniquePlayers: 1 } };
		} else {
			const pickMissingWord = statsForLanguage.pickMissingWord;
			if (pickMissingWord === undefined) {
				statsForLanguage.pickMissingWord = { totalSessions: 1, totalScore: 0, uniquePlayers: 1 };
			} else {
				pickMissingWord.totalSessions++;
				if (userDocument.scores?.[learningLocale]?.pickMissingWord === undefined) {
					pickMissingWord.uniquePlayers++;
				}
			}
		}
	}

	const scores = userDocument.scores;
	if (scores === undefined) {
		userDocument.scores = { [learningLocale]: { pickMissingWord: { totalScore: 0, sessionCount: 1 } } };
	} else {
		const scoreForLanguage = scores[learningLocale];
		if (scoreForLanguage === undefined) {
			scores[learningLocale] = { pickMissingWord: { totalScore: 0, sessionCount: 1 } };
		} else {
			const pickMissingWord = scoreForLanguage.pickMissingWord;
			if (pickMissingWord === undefined) {
				scoreForLanguage.pickMissingWord = { totalScore: 0, sessionCount: 1 };
			} else {
				pickMissingWord.sessionCount++;
			}
		}
	}

	await session.store(guildStatsDocument);
	await session.store(userDocument);
	await session.saveChanges();

	session.dispose();

	await postponeReply([client, bot], interaction);

	const customId = createInteractionCollector([client, bot], {
		type: Discord.InteractionTypes.MessageComponent,
		userId: interaction.user.id,
		onCollect: async (selection) => {
			acknowledge([client, bot], selection);

			const selectionCustomId = selection.data?.customId;
			if (selectionCustomId === undefined) {
				return;
			}

			const [_, id] = decodeId<WordButtonID>(selectionCustomId);
			if (id === undefined) {
				return;
			}

			const pick = data.sentenceSelection.allPicks.find((pick) => pick[0] === id);
			const isCorrect = pick === data.sentenceSelection.correctPick;

			const session = client.database.openSession();

			const guildStatsDocument = client.cache.documents.guildStats.get(guildId.toString());
			const userDocument = client.cache.documents.users.get(interaction.user.id.toString());
			if (guildStatsDocument === undefined || userDocument === undefined) {
				return;
			}

			const pickMissingWord = {
				guildStats: guildStatsDocument?.stats?.[learningLocale]?.pickMissingWord,
				user: userDocument?.scores?.[learningLocale]?.pickMissingWord,
			};
			if (pickMissingWord.guildStats === undefined || pickMissingWord.user === undefined) {
				return;
			}

			if (isCorrect) {
				pickMissingWord.guildStats.totalScore++;
				pickMissingWord.user.totalScore++;
			}

			await session.store(guildStatsDocument);
			await session.store(userDocument);
			await session.saveChanges();

			session.dispose();

			if (isCorrect) {
				data.embedColour = constants.colors.lightGreen;
				data.sessionScore++;
			} else {
				data.embedColour = constants.colors.red;
			}

			data.sentenceSelection = await getSentenceSelection(client, learningLocale);

			editReply([client, bot], interaction, await getGameView(client, data, userDocument, { locale, learningLocale }));
		},
	});

	const skipButtonCustomId = createInteractionCollector([client, bot], {
		type: Discord.InteractionTypes.MessageComponent,
		userId: interaction.user.id,
		onCollect: async (selection) => {
			acknowledge([client, bot], selection);

			data.sentenceSelection = await getSentenceSelection(client, learningLocale);

			editReply([client, bot], interaction, await getGameView(client, data, userDocument, { locale, learningLocale }));
		},
	});

	const data: GameData = {
		sentenceSelection: await getSentenceSelection(client, learningLocale),
		embedColour: constants.colors.blue,
		customId,
		skipButtonCustomId,
		sessionScore: 0,
	};

	editReply([client, bot], interaction, await getGameView(client, data, userDocument, { locale, learningLocale }));
}

async function getGameView(
	client: Client,
	data: GameData,
	userDocument: User,
	{ locale, learningLocale }: { locale: Locale; learningLocale: Locale },
): Promise<Discord.InteractionCallbackData> {
	const totalScore = userDocument.scores?.[learningLocale]?.pickMissingWord?.totalScore ?? 0;

	const strings = {
		sentence: localise(client, "game.strings.sentence", locale)(),
		translation: localise(client, "game.strings.translation", locale)(),
		skip: localise(client, "game.strings.skip", locale)(),
		sourcedFrom: localise(client, "game.strings.sourcedFrom", locale)({ source: licences.dictionaries.tatoeba.name }),
		correctGuesses: localise(client, "game.strings.correctGuesses", locale)({ number: data.sessionScore }),
		allTime: localise(client, "game.strings.allTime", locale)({ number: totalScore }),
	};

	const sentenceSource = constants.links.generateTatoebaSentenceLink(data.sentenceSelection.sentencePair.sentenceId);
	const translationSource = constants.links.generateTatoebaSentenceLink(
		data.sentenceSelection.sentencePair.translationId,
	);

	const mask = constants.symbols.game.mask.repeat(data.sentenceSelection.correctPick[1].length);

	return {
		embeds: [
			{
				description: `${constants.symbols.link} [${strings.sentence}](${sentenceSource}) · [${strings.translation}](${translationSource})`,
				color: constants.colors.peach,
				footer: { text: strings.sourcedFrom },
			},
			{
				title: data.sentenceSelection.sentencePair.sentence.replaceAll(
					constants.patterns.wholeWord(data.sentenceSelection.correctPick[1]),
					mask,
				),
				description: data.sentenceSelection.sentencePair.translation,
				footer: { text: `${strings.correctGuesses} · ${strings.allTime}` },
				color: data.embedColour,
			},
		],
		components: [
			{
				type: Discord.MessageComponentTypes.ActionRow,
				components: data.sentenceSelection.allPicks.map((pick) => ({
					type: Discord.MessageComponentTypes.Button,
					style: Discord.ButtonStyles.Primary,
					label: pick[1],
					customId: encodeId<WordButtonID>(data.customId, [pick[0]]),
				})) as [Discord.ButtonComponent],
			},
			{
				type: Discord.MessageComponentTypes.ActionRow,
				components: [
					{
						type: Discord.MessageComponentTypes.Button,
						style: Discord.ButtonStyles.Secondary,
						label: `${constants.symbols.interactions.menu.controls.forward} ${strings.skip}`,
						customId: data.skipButtonCustomId,
					},
				] as [Discord.ButtonComponent],
			},
		],
	};
}

async function getRandomIds(client: Client, locale: Locale): Promise<string[]> {
	const pipeline = client.cache.database.pipeline();
	for (const _ of Array(defaults.GAME_WORD_SELECTION).keys()) {
		pipeline.srandmember(`${locale}:index`);
	}

	const results = (await pipeline.exec()) ?? undefined;
	if (results === undefined) {
		throw "StateError: Failed to get random indexes for sentence pairs.";
	}

	const indexes = results.map((result) => {
		const [error, index] = result as [Error | null, string | null];
		if ((error ?? undefined) !== undefined || (index ?? undefined) === undefined) {
			throw `StateError: Failed to get random index for sentence pair: ${index}`;
		}

		return index as string;
	});

	return indexes;
}

/** Represents a pair of a sentence and its translation. */
interface SentencePair {
	sentenceId: number;

	/** The source sentence. */
	sentence: string;

	translationId: number;

	/** The translation of the sentence. */
	translation: string;
}

async function getSentencePairById(client: Client, locale: Locale, id: string): Promise<SentencePair> {
	const pairRaw = await client.cache.database.get(`${locale}:${id}`).then((sentencePair) => sentencePair ?? undefined);
	if (pairRaw === undefined) {
		throw `StateError: Failed to get sentence pair for locale ${locale} and index ${id}.`;
	}

	const [sentenceId, sentence, translationId, translation] = JSON.parse(pairRaw) as [number, string, number, string];
	return { sentenceId, sentence, translationId, translation };
}

async function getSentencePairsByIds(client: Client, locale: Locale, ids: string[]): Promise<SentencePair[]> {
	const promises: Promise<SentencePair>[] = [];
	for (const id of ids) {
		promises.push(getSentencePairById(client, locale, id));
	}

	const sentencePairs = await Promise.all(promises);
	return sentencePairs;
}

function getWords(...sentences: string[]): string[] {
	const wordsAll: string[] = [];

	for (const sentence of sentences) {
		const segmentsRaw = Array.from(wordSegmenter.segment(sentence));

		const segmentsProcessedSeparate: Intl.SegmentData[][] = [];
		let isCompound = false;

		for (const segment of segmentsRaw) {
			if (/[’'-]/.test(segment.segment)) {
				isCompound = true;
				segmentsProcessedSeparate.at(-1)?.push(segment);
				continue;
			}

			if (isCompound) {
				isCompound = false;
				segmentsProcessedSeparate.at(-1)?.push(segment);
				continue;
			}

			segmentsProcessedSeparate.push([segment]);
		}

		const segmentsProcessed = segmentsProcessedSeparate.map<{ segment: string; isWordLike: boolean }>((segments) => {
			let isWordLike = false;
			const segmentStrings: string[] = [];
			for (const segment of segments) {
				isWordLike ||= segment.isWordLike ?? false;
				segmentStrings.push(segment.segment);
			}

			return { segment: segmentStrings.join(""), isWordLike };
		});

		for (const segment of segmentsProcessed) {
			if (!segment.isWordLike) {
				continue;
			}

			if (/[0-9]/.test(segment.segment)) {
				continue;
			}

			wordsAll.push(segment.segment);
		}
	}

	return wordsAll;
}

// ! Mutates the original array.
function extractRandomWord(words: string[]): string {
	const word = words.splice(random(words.length), 1).at(0);
	if (word === undefined) {
		throw "StateError: Failed to extract random word.";
	}

	return word;
}

function camouflageDecoys(likeness: string, decoys: string[]): string[] {
	let results = [...decoys];

	const isUppercase = likeness.toUpperCase() === likeness;
	if (isUppercase) {
		results = results.map((result) => result.toUpperCase());
	}

	const isLowercase = likeness.toLowerCase() === likeness;
	if (isLowercase) {
		results = results.map((result) => result.toLowerCase());
	}

	const isFirstCapitalised = capitalise(likeness) === likeness;
	if (isFirstCapitalised) {
		results = results.map((result) => capitalise(result));
	}

	return results;
}

type Selection = [id: string, word: string];
interface SentenceSelection {
	correctPick: Selection;
	allPicks: Selection[];
	sentencePair: SentencePair;
}

async function getSentenceSelection(client: Client, locale: Locale): Promise<SentenceSelection> {
	// Pick random IDs of sentences to take words from.
	const ids = await getRandomIds(client, locale);
	const sentencePairs = await getSentencePairsByIds(client, locale, ids);

	const mainSentencePair = sentencePairs.splice(random(sentencePairs.length), 1).at(0);
	if (mainSentencePair === undefined) {
		throw "StateError: Failed to select main sentence pair.";
	}
	const mainId = ids
		.splice(
			ids.findIndex((id) => parseInt(id) === mainSentencePair.sentenceId),
			1,
		)
		.at(0);
	if (mainId === undefined) {
		throw "StateError: Failed to select main sentence pair ID.";
	}

	const mainSentenceWords = Array.from(new Set(getWords(mainSentencePair.sentence)));
	const mainWord = extractRandomWord(mainSentenceWords);

	const mainWordLowercase = mainWord.toLowerCase();
	const wordsUnordered = Array.from(new Set(getWords(...sentencePairs.map((pair) => pair.sentence))))
		.filter((word) => word.toLowerCase() !== mainWordLowercase)
		.map((word) => ({ word, sort: Math.random() }))
		.sort((a, b) => a.sort - b.sort)
		.map(({ word }) => word);
	if (wordsUnordered.length < defaults.GAME_WORD_SELECTION - 1) {
		for (const _ of Array(defaults.GAME_WORD_SELECTION - 1 - wordsUnordered.length).keys()) {
			wordsUnordered.push("?");
		}
	}

	const words = Array.from(wordsUnordered)
		.map((word) => ({ word, sort: levenshtein.distance(mainWord, word) }))
		.sort((a, b) => b.sort - a.sort)
		.map(({ word }) => word);

	const decoysExposed: string[] = [];
	while (decoysExposed.length < defaults.GAME_WORD_SELECTION - 1) {
		const word = words.pop();
		if (word === undefined) {
			continue;
		}

		decoysExposed.push(word);
	}

	const decoys = camouflageDecoys(mainWord, decoysExposed);

	const correctPick: Selection = [mainId, mainWord];
	const allPicksRaw: Selection[] = [correctPick];
	for (const index of Array(ids.length).keys()) {
		const [id, word] = [ids[index], decoys[index]];
		if (id === undefined || word === undefined) {
			throw "StateError: Failed to create pick.";
		}

		allPicksRaw.push([id, word]);
	}
	const allPicks = allPicksRaw
		.map((pick) => ({ pick, sort: Math.random() }))
		.sort((a, b) => a.sort - b.sort)
		.map(({ pick }) => pick);

	return { correctPick, allPicks, sentencePair: mainSentencePair };
}

export default command;
