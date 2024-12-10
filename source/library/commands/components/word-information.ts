import type { DictionarySearchMode } from "logos:constants/dictionaries";
import { code, trim } from "logos:constants/formatting";
import { isUnknownPartOfSpeech } from "logos:constants/parts-of-speech";
import type { DefinitionField, DictionaryEntry, ExpressionField } from "logos/adapters/dictionaries/dictionary-entry";
import type { Client } from "logos/client";
import { InteractionCollector } from "logos/collectors";
import { WordSourceNotice } from "logos/commands/components/source-notices/word-source-notice";

async function displayWordInformation(
	client: Client,
	interaction: Logos.Interaction,
	entries: DictionaryEntry[],
	{ searchMode }: { searchMode: DictionarySearchMode },
): Promise<void> {
	const showButton = interaction.parameters.show
		? undefined
		: client.services.global("interactionRepetition").getShowButton(interaction);

	let currentView: ContentTabs;
	if (searchMode === "inflection") {
		currentView = ContentTabs.Inflection;
	} else {
		currentView = ContentTabs.Definitions;
	}

	await displayMenu(client, interaction, {
		entries,
		currentView,
		dictionaryEntryIndex: 0,
		inflectionTableIndex: 0,
		showButton,
		verbose: interaction.parameters.verbose ?? false,
	});
}

enum ContentTabs {
	Definitions = 0,
	Inflection = 1,
}

interface WordViewData {
	readonly entries: DictionaryEntry[];
	showButton: Discord.ButtonComponent | undefined;
	currentView: ContentTabs;
	dictionaryEntryIndex: number;
	inflectionTableIndex: number;
	verbose: boolean;
}

async function displayMenu(client: Client, interaction: Logos.Interaction, data: WordViewData): Promise<void> {
	const entry = data.entries.at(data.dictionaryEntryIndex);
	if (entry === undefined) {
		return;
	}

	client
		.editReply(interaction, {
			embeds: generateEmbeds(client, interaction, data, entry),
			components: await generateButtons(client, interaction, data, entry),
		})
		.ignore();
}

function generateEmbeds(
	client: Client,
	interaction: Logos.Interaction,
	data: WordViewData,
	entry: DictionaryEntry,
): Discord.Camelize<Discord.DiscordEmbed>[] {
	switch (data.currentView) {
		case ContentTabs.Definitions: {
			return entryToEmbeds(client, interaction, data, entry);
		}
		case ContentTabs.Inflection: {
			const inflectionTable = entry.inflection?.tabs?.at(data.inflectionTableIndex);
			if (inflectionTable === undefined) {
				return [];
			}

			return [inflectionTable];
		}
	}
}

type MenuButtonID = [index: string];

async function generateButtons(
	client: Client,
	interaction: Logos.Interaction,
	data: WordViewData,
	entry: DictionaryEntry,
): Promise<Discord.MessageComponents> {
	const paginationControls: Discord.ButtonComponent[][] = [];

	switch (data.currentView) {
		case ContentTabs.Definitions: {
			const isFirst = data.dictionaryEntryIndex === 0;
			const isLast = data.dictionaryEntryIndex === data.entries.length - 1;

			if (isFirst && isLast) {
				break;
			}

			const previousPageButton = new InteractionCollector(client, {
				only: interaction.parameters.show ? [interaction.user.id] : undefined,
			});

			const nextPageButton = new InteractionCollector(client, {
				only: interaction.parameters.show ? [interaction.user.id] : undefined,
			});

			previousPageButton.onInteraction(async (buttonPress) => {
				client.acknowledge(buttonPress).ignore();

				if (!isFirst) {
					data.dictionaryEntryIndex -= 1;
				}

				await displayMenu(client, interaction, data);
			});

			nextPageButton.onInteraction(async (buttonPress) => {
				client.acknowledge(buttonPress).ignore();

				if (!isLast) {
					data.dictionaryEntryIndex += 1;
				}

				await displayMenu(client, interaction, data);
			});

			await client.registerInteractionCollector(previousPageButton);
			await client.registerInteractionCollector(nextPageButton);

			const strings = constants.contexts.wordPage({
				localise: client.localise,
				locale: interaction.displayLocale,
			});
			paginationControls.push([
				{
					type: Discord.MessageComponentTypes.Button,
					label: constants.emojis.interactions.menu.controls.back,
					customId: previousPageButton.customId,
					style: Discord.ButtonStyles.Secondary,
					disabled: isFirst,
				},
				{
					type: Discord.MessageComponentTypes.Button,
					label: `${strings.page} ${data.dictionaryEntryIndex + 1}/${data.entries.length}`,
					style: Discord.ButtonStyles.Secondary,
					customId: constants.components.none,
				},
				{
					type: Discord.MessageComponentTypes.Button,
					label: constants.emojis.interactions.menu.controls.forward,
					customId: nextPageButton.customId,
					style: Discord.ButtonStyles.Secondary,
					disabled: isLast,
				},
			]);

			break;
		}
		case ContentTabs.Inflection: {
			if (entry.inflection === undefined) {
				return [];
			}

			const rows = entry.inflection.tabs.toChunked(5).reverse();

			const button = new InteractionCollector<MenuButtonID>(client, {
				only: interaction.parameters.show ? [interaction.user.id] : undefined,
			});

			button.onInteraction(async (buttonPress) => {
				client.acknowledge(buttonPress).ignore();

				if (entry.inflection === undefined) {
					await displayMenu(client, interaction, data);
					return;
				}

				const customId = buttonPress.data?.customId;
				if (customId === undefined) {
					return;
				}

				const [_, indexString] = InteractionCollector.decodeId<MenuButtonID>(customId);
				const index = Number(indexString);

				if (index >= 0 && index <= entry.inflection?.tabs?.length) {
					data.inflectionTableIndex = index;
				}

				await displayMenu(client, interaction, data);
			});

			await client.registerInteractionCollector(button);

			for (const [row, rowIndex] of rows.map<[typeof entry.inflection.tabs, number]>((r, i) => [r, i])) {
				const buttons = row.map<Discord.ButtonComponent>((table, index) => {
					const index_ = rowIndex * 5 + index;

					return {
						type: Discord.MessageComponentTypes.Button,
						label: table.title,
						customId: button.encodeId([index_.toString()]),
						disabled: data.inflectionTableIndex === index_,
						style: Discord.ButtonStyles.Secondary,
					};
				});

				if (buttons.length > 1) {
					paginationControls.unshift(buttons);
				}
			}
		}
	}

	const row: Discord.ButtonComponent[] = [];

	if (entry.definitions !== undefined) {
		const definitionsMenuButton = new InteractionCollector(client, {
			only: interaction.parameters.show ? [interaction.user.id] : undefined,
		});

		definitionsMenuButton.onInteraction(async (buttonPress) => {
			client.acknowledge(buttonPress).ignore();

			data.inflectionTableIndex = 0;
			data.currentView = ContentTabs.Definitions;

			await displayMenu(client, interaction, data);
		});

		await client.registerInteractionCollector(definitionsMenuButton);

		const strings = constants.contexts.definitionsView({
			localise: client.localise,
			locale: interaction.displayLocale,
		});
		row.push({
			type: Discord.MessageComponentTypes.Button,
			label: strings.definitions,
			disabled: data.currentView === ContentTabs.Definitions,
			customId: definitionsMenuButton.customId,
			style: Discord.ButtonStyles.Primary,
		});
	}

	if (entry.inflection !== undefined) {
		const inflectionMenuButton = new InteractionCollector(client, {
			only: interaction.parameters.show ? [interaction.user.id] : undefined,
		});

		inflectionMenuButton.onInteraction(async (buttonPress) => {
			client.acknowledge(buttonPress).ignore();

			data.currentView = ContentTabs.Inflection;

			await displayMenu(client, interaction, data);
		});

		await client.registerInteractionCollector(inflectionMenuButton);

		const strings = constants.contexts.inflectionView({
			localise: client.localise,
			locale: interaction.displayLocale,
		});
		row.push({
			type: Discord.MessageComponentTypes.Button,
			label: strings.inflection,
			disabled: data.currentView === ContentTabs.Inflection,
			customId: inflectionMenuButton.customId,
			style: Discord.ButtonStyles.Primary,
		});
	}

	if (row.length === 1) {
		row.pop();
	}

	if (data.showButton !== undefined) {
		row.push(data.showButton);
	}

	const sourceNotice = new WordSourceNotice(client, {
		interaction,
		sources: entry.sources.map(({ link, licence }) => `[${licence.name}](${link})`),
	});

	await sourceNotice.register();

	row.push(sourceNotice.button);

	if (row.length > 1) {
		paginationControls.push(row);
	}

	return paginationControls.map((row) => ({
		type: Discord.MessageComponentTypes.ActionRow,
		components: row as [Discord.ButtonComponent],
	}));
}

function entryToEmbeds(
	client: Client,
	interaction: Logos.Interaction,
	data: WordViewData,
	entry: DictionaryEntry,
): Discord.Camelize<Discord.DiscordEmbed>[] {
	let partOfSpeechDisplayed: string;
	if (entry.partOfSpeech === undefined) {
		const strings = constants.contexts.partOfSpeechUnknown({
			localise: client.localise,
			locale: interaction.displayLocale,
		});
		partOfSpeechDisplayed = strings.unknown;
	} else {
		const partOfSpeech = entry.partOfSpeech.detected;
		if (partOfSpeech === "unknown") {
			partOfSpeechDisplayed = partOfSpeech;
		} else {
			const strings = constants.contexts.partOfSpeech({
				localise: client.localise,
				locale: interaction.displayLocale,
			});
			partOfSpeechDisplayed = strings.partOfSpeech(partOfSpeech);
			if (isUnknownPartOfSpeech(partOfSpeech)) {
				partOfSpeechDisplayed += ` — '${partOfSpeech}'`;
			}
		}
	}
	const partOfSpeechFormatted = `***${partOfSpeechDisplayed}***`;

	const word = entry.lemma.value;

	const embeds: Discord.Camelize<Discord.DiscordEmbed>[] = [];
	const fields: Discord.Camelize<Discord.DiscordEmbedField>[] = [];

	if (entry.definitions !== undefined && entry.definitions.length > 0) {
		const definitionsStringified = stringifyEntries(client, interaction, entry.definitions, "definitions");
		const definitionsFitted = fitTextToFieldSize(client, interaction, definitionsStringified, data.verbose);

		if (data.verbose) {
			const strings = constants.contexts.nativeDefinitionsForWord({
				localise: client.localise,
				locale: interaction.displayLocale,
			});
			embeds.push({
				title: `${constants.emojis.commands.word.definitions} ${strings.nativeDefinitionsForWord({ word })}`,
				description: `${partOfSpeechFormatted}\n\n${definitionsFitted}`,
				color: constants.colours.husky,
			});
		} else {
			const strings = constants.contexts.nativeDefinitions({
				localise: client.localise,
				locale: interaction.displayLocale,
			});
			fields.push({
				name: `${constants.emojis.commands.word.definitions} ${strings.nativeDefinitions}`,
				value: definitionsFitted,
			});
		}
	}

	if (entry.translations !== undefined && entry.translations.length > 0) {
		const definitionsStringified = stringifyEntries(client, interaction, entry.translations, "definitions");
		const definitionsFitted = fitTextToFieldSize(client, interaction, definitionsStringified, data.verbose);

		if (data.verbose) {
			const strings = constants.contexts.definitionsForWord({
				localise: client.localise,
				locale: interaction.displayLocale,
			});
			embeds.push({
				title: `${constants.emojis.commands.word.definitions} ${strings.definitionsForWord({ word })}`,
				description: `${partOfSpeechFormatted}\n\n${definitionsFitted}`,
				color: constants.colours.husky,
			});
		} else {
			const strings = constants.contexts.definitions({
				localise: client.localise,
				locale: interaction.displayLocale,
			});
			fields.push({
				name: `${constants.emojis.commands.word.definitions} ${strings.definitions}`,
				value: definitionsFitted,
			});
		}
	}

	if (entry.expressions !== undefined && entry.expressions.length > 0) {
		const expressionsStringified = stringifyEntries(client, interaction, entry.expressions, "expressions");
		const expressionsFitted = fitTextToFieldSize(client, interaction, expressionsStringified, data.verbose);

		const strings = constants.contexts.expressions({
			localise: client.localise,
			locale: interaction.displayLocale,
		});
		if (data.verbose) {
			embeds.push({
				title: `${constants.emojis.commands.word.expressions} ${strings.expressions}`,
				description: expressionsFitted,
				color: constants.colours.husky,
			});
		} else {
			fields.push({
				name: `${constants.emojis.commands.word.expressions} ${strings.expressions}`,
				value: trim(expressionsFitted, 1024),
			});
		}
	}

	if (entry.etymology !== undefined) {
		let etymology: string;
		if (entry.etymology.labels === undefined) {
			etymology = entry.etymology.value;
		} else if (entry.etymology.value === undefined || entry.etymology.value.length === 0) {
			etymology = tagsToString(entry.etymology.labels);
		} else {
			etymology = `${tagsToString(entry.etymology.labels)} ${entry.etymology.value}`;
		}

		const strings = constants.contexts.etymology({
			localise: client.localise,
			locale: interaction.displayLocale,
		});
		if (data.verbose) {
			embeds.push({
				title: `${constants.emojis.commands.word.etymology} ${strings.etymology}`,
				description: etymology,
				color: constants.colours.husky,
			});
		} else {
			fields.push({
				name: `${constants.emojis.commands.word.etymology} ${strings.etymology}`,
				value: trim(etymology, 1024),
			});
		}
	}

	const strings = constants.contexts.language({ localise: client.localise, locale: interaction.displayLocale });

	const languageFlag = constants.emojis.flags[entry.language];
	const languageName = strings.language(entry.language);

	if (!data.verbose) {
		return [
			{
				title: `${constants.emojis.commands.word.word} ${word}`,
				description: partOfSpeechFormatted,
				fields,
				color: constants.colours.husky,
				footer: { text: `${languageFlag} ${languageName}` },
			},
		];
	}

	const lastEmbed = embeds.at(-1);
	if (lastEmbed !== undefined) {
		lastEmbed.footer = { text: `${languageFlag} ${languageName}` };
	}

	return embeds;
}

function tagsToString(tags: string[]): string {
	return tags.map((tag) => code(tag)).join(" ");
}

type EntryType = "definitions" | "expressions";

function isDefinition(_entry: DefinitionField | ExpressionField, entryType: EntryType): _entry is DefinitionField {
	return entryType === "definitions";
}

const parenthesesExpression = /\((.+?)\)/g;

function stringifyEntries<
	T extends EntryType,
	E extends DefinitionField[] | ExpressionField[] = T extends "definitions" ? DefinitionField[] : ExpressionField[],
>(
	client: Client,
	interaction: Logos.Interaction,
	entries: E,
	entryType: T,
	options?: { root: string; depth: number },
): string[] {
	const entriesStringified = entries.map((entry, indexZeroBased) => {
		const parenthesesContents: string[] = [];
		for (const [match, contents] of entry.value.matchAll(parenthesesExpression)) {
			if (contents === undefined) {
				throw new Error(
					`'${match}' was matched to the parentheses regular expression, but the contents were \`undefined\`.`,
				);
			}

			if (parenthesesContents.includes(contents)) {
				continue;
			}

			parenthesesContents.push(contents);
		}

		const value = parenthesesContents.reduce(
			(string, match) => string.replace(`(${match})`, `(*${match}*)`),
			entry.value,
		);

		let anchor = entry.labels === undefined ? value : `${tagsToString(entry.labels)} ${value}`;
		if (isDefinition(entry, entryType)) {
			if (entry.relations !== undefined) {
				const strings = constants.contexts.wordRelations({
					localise: client.localise,
					locale: interaction.displayLocale,
				});

				const synonyms = entry.relations.synonyms ?? [];
				const antonyms = entry.relations.antonyms ?? [];
				const diminutives = entry.relations.diminutives ?? [];
				const augmentatives = entry.relations.augmentatives ?? [];

				if (synonyms.length > 0 || antonyms.length > 0) {
					anchor += "\n  - ";
					const columns: string[] = [];

					if (synonyms.length > 0) {
						columns.push(`**${strings.synonyms}**: ${synonyms.join(", ")}`);
					}

					if (antonyms.length > 0) {
						columns.push(`**${strings.antonyms}**: ${antonyms.join(", ")}`);
					}

					anchor += columns.join(` ${constants.special.divider} `);
				}

				if (diminutives.length > 0 || augmentatives.length > 0) {
					anchor += "\n  - ";
					const columns: string[] = [];

					if (diminutives.length > 0) {
						columns.push(`**${strings.diminutives}**: ${diminutives.join(", ")}`);
					}

					if (augmentatives.length > 0) {
						columns.push(`**${strings.augmentatives}**: ${augmentatives.join(", ")}`);
					}

					anchor += columns.join(` ${constants.special.divider} `);
				}
			}

			if (value.endsWith(":")) {
				const definitions = entry.definitions ?? [];
				if (definitions.length === 0) {
					return anchor;
				}

				const index = indexZeroBased + 1;
				const newRoot = options === undefined ? `${index}` : `${options.root}.${index}`;
				const entriesStringified = stringifyEntries(client, interaction, definitions, "definitions", {
					root: newRoot,
					depth: (options?.depth ?? 0) + 1,
				}).join("\n");
				return `${anchor}\n${entriesStringified}`;
			}
		}

		return anchor;
	});

	const entriesEnlisted = entriesStringified
		.map((entry, indexZeroBased) => {
			const index = indexZeroBased + 1;

			if (options === undefined) {
				return `${index}. ${entry}`;
			}

			return `${options.root}.${index}. ${entry}`;
		})
		.join("\n");

	return entriesEnlisted
		.split("\n")
		.map((entry) => `${constants.special.meta.whitespace.repeat((options?.depth ?? 0) * 2)}${entry}`);
}

function fitTextToFieldSize(
	client: Client,
	interaction: Logos.Interaction,
	textParts: string[],
	verbose: boolean,
): string {
	const strings = constants.contexts.definitionsOmitted({
		localise: client.localise,
		locale: interaction.displayLocale,
	});
	const characterOverhead =
		strings.definitionsOmitted({
			definitions: client.pluralise("word.strings.definitionsOmitted.definitions", interaction.displayLocale, {
				quantity: textParts.length,
			}),
			flag: "verbose",
		}).length + 20;

	const maxCharacterCount = verbose ? 2048 : 512;

	let characterCount = 0;
	const stringsToDisplay: string[] = [];
	for (const [string, index] of textParts.map<[string, number]>((s, i) => [s, i])) {
		characterCount += string.length;

		if (characterCount + (index + 1 === textParts.length ? 0 : characterOverhead) >= maxCharacterCount) {
			break;
		}

		stringsToDisplay.push(string);
	}

	const stringsOmitted = textParts.length - stringsToDisplay.length;

	let fittedString = stringsToDisplay.join("\n");
	if (stringsOmitted !== 0) {
		fittedString += `\n*${strings.definitionsOmitted({
			definitions: client.pluralise("word.strings.definitionsOmitted.definitions", interaction.displayLocale, {
				quantity: stringsOmitted,
			}),
			flag: "verbose",
		})}*`;
	}

	return fittedString;
}

export { displayWordInformation };
