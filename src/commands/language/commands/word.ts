import {
	ApplicationCommandFlags,
	ApplicationCommandOptionTypes,
	Bot,
	ButtonComponent,
	ButtonStyles,
	DiscordEmbedField,
	editOriginalInteractionResponse,
	Embed,
	Interaction,
	InteractionResponseTypes,
	InteractionTypes,
	MessageComponents,
	MessageComponentTypes,
	sendInteractionResponse,
} from 'discordeno';
import { Commands, createLocalisations, localise, Words } from 'logos/assets/localisations/mod.ts';
import { DictionaryEntry, TaggedValue } from 'logos/src/commands/language/data/types.ts';
import { CommandBuilder } from 'logos/src/commands/command.ts';
import { show } from 'logos/src/commands/parameters.ts';
import { Client } from 'logos/src/client.ts';
import { chunk, createInteractionCollector, diagnosticMentionUser, fromHex, parseArguments } from 'logos/src/utils.ts';
import configuration from 'logos/configuration.ts';
import { BulletStyles, code, list } from 'logos/formatting.ts';
import { WordTypes } from 'logos/types.ts';

const command: CommandBuilder = {
	...createLocalisations(Commands.word),
	defaultMemberPermissions: ['VIEW_CHANNEL'],
	handle: handleSearchWord,
	options: [{
		...createLocalisations(Commands.word.options.word),
		type: ApplicationCommandOptionTypes.String,
		required: true,
	}, {
		...createLocalisations(Commands.word.options.verbose),
		type: ApplicationCommandOptionTypes.Boolean,
	}, show],
};

/** Allows the user to look up a word and get information about it. */
async function handleSearchWord(
	[client, bot]: [Client, Bot],
	interaction: Interaction,
): Promise<void> {
	const [{ word, verbose, show }] = parseArguments(
		interaction.data?.options,
		{ verbose: 'boolean', show: 'boolean' },
	);
	if (word === undefined) return;

	const guild = client.cache.guilds.get(interaction.guildId!);
	if (guild === undefined) return;

	const dictionaries = client.features.dictionaryAdapters.get('Romanian');
	if (dictionaries === undefined) {
		return void sendInteractionResponse(
			bot,
			interaction.id,
			interaction.token,
			{
				type: InteractionResponseTypes.ChannelMessageWithSource,
				data: {
					flags: ApplicationCommandFlags.Ephemeral,
					embeds: [{
						description: localise(Commands.word.strings.noDictionaryAdapters, interaction.locale),
						color: configuration.messages.colors.yellow,
					}],
				},
			},
		);
	}

	await sendInteractionResponse(
		bot,
		interaction.id,
		interaction.token,
		{
			type: InteractionResponseTypes.DeferredChannelMessageWithSource,
			data: { flags: !show ? ApplicationCommandFlags.Ephemeral : undefined },
		},
	);

	client.log.info(
		`Looking up the word '${word}' from ${dictionaries.length} dictionaries ` +
			`as requested by ${diagnosticMentionUser(interaction.user, true)} on ${guild.name}...`,
	);

	const entries: DictionaryEntry[] = [];
	for (const dictionary of dictionaries) {
		const data = await dictionary.query(word, guild.language);
		if (data === undefined) continue;

		const entriesNew = dictionary.parse(data, interaction.locale);
		if (entriesNew === undefined) continue;

		entries.push(...entriesNew);
	}

	if (entries.length === 0) {
		return void editOriginalInteractionResponse(
			bot,
			interaction.token,
			{
				embeds: [{
					description: localise(Commands.word.strings.noResults, interaction.locale),
					color: configuration.messages.colors.yellow,
				}],
			},
		);
	}

	return void displayMenu(
		[client, bot],
		interaction,
		undefined,
		{
			entries,
			currentView: ContentTabs.Definitions,
			dictionaryEntryIndex: 0,
			inflectionTableIndex: 0,
			verbose: verbose ?? false,
		},
	);
}

enum ContentTabs {
	Definitions = 0,
	Inflection,
}

interface WordViewData {
	readonly entries: DictionaryEntry[];
	currentView: ContentTabs;
	dictionaryEntryIndex: number;
	inflectionTableIndex: number;
	verbose: boolean;
}

function displayMenu(
	[client, bot]: [Client, Bot],
	interaction: Interaction,
	selection: Interaction | undefined,
	data: WordViewData,
): void {
	if (selection !== undefined) {
		sendInteractionResponse(bot, selection.id, selection.token, {
			type: InteractionResponseTypes.DeferredUpdateMessage,
		});
	}

	const entry = data.entries.at(data.dictionaryEntryIndex)!;

	editOriginalInteractionResponse(bot, interaction.token, {
		embeds: [generateEmbed(data, entry, interaction.locale)],
		components: generateButtons([client, bot], interaction, data, entry),
	});
}

function generateEmbed(
	data: WordViewData,
	entry: DictionaryEntry,
	locale: string | undefined,
): Embed {
	switch (data.currentView) {
		case ContentTabs.Definitions: {
			return entryToEmbed(entry, locale, data.verbose);
		}
		case ContentTabs.Inflection: {
			return entry.inflectionTable!.at(data.inflectionTableIndex)!;
		}
	}
}

function generateButtons(
	[client, bot]: [Client, Bot],
	interaction: Interaction,
	data: WordViewData,
	entry: DictionaryEntry,
): MessageComponents {
	const paginationControls: ButtonComponent[][] = [];

	switch (data.currentView) {
		case ContentTabs.Definitions: {
			const isFirst = data.dictionaryEntryIndex === 0;
			const isLast = data.dictionaryEntryIndex === data.entries.length - 1;

			if (isFirst && isLast) break;

			const previousPageButtonId = createInteractionCollector([client, bot], {
				type: InteractionTypes.MessageComponent,
				onCollect: (_bot, selection) => {
					if (!isFirst) data.dictionaryEntryIndex--;
					return void displayMenu([client, bot], interaction, selection, data);
				},
			});

			const nextPageButtonId = createInteractionCollector([client, bot], {
				type: InteractionTypes.MessageComponent,
				onCollect: (_bot, selection) => {
					if (!isLast) data.dictionaryEntryIndex++;
					return void displayMenu([client, bot], interaction, selection, data);
				},
			});

			const pageString = localise(Commands.word.strings.page, interaction.locale);

			paginationControls.push([{
				type: MessageComponentTypes.Button,
				label: '«',
				customId: previousPageButtonId,
				style: ButtonStyles.Secondary,
				disabled: isFirst,
			}, {
				type: MessageComponentTypes.Button,
				label: `${pageString} ${data.dictionaryEntryIndex + 1}/${data.entries.length}`,
				style: ButtonStyles.Secondary,
				customId: 'none',
			}, {
				type: MessageComponentTypes.Button,
				label: '»',
				customId: nextPageButtonId,
				style: ButtonStyles.Secondary,
				disabled: isLast,
			}]);

			break;
		}
		case ContentTabs.Inflection: {
			if (entry.inflectionTable === undefined) return [];

			const rows = chunk(entry.inflectionTable, 5);
			rows.reverse();

			const buttonId = createInteractionCollector([client, bot], {
				type: InteractionTypes.MessageComponent,
				onCollect: (_bot, selection) => {
					if (entry.inflectionTable === undefined || selection.data === undefined) {
						return void displayMenu([client, bot], interaction, selection, data);
					}

					const [_buttonId, indexString] = selection.data.customId!.split('|');
					const index = Number(indexString);

					if (index >= 0 && index <= entry.inflectionTable?.length) {
						data.inflectionTableIndex = index;
					}

					return void displayMenu([client, bot], interaction, selection, data);
				},
			});

			for (const [row, rowIndex] of rows.map<[typeof entry.inflectionTable, number]>((r, i) => [r, i])) {
				const buttons = row.map<ButtonComponent>((table, index) => {
					const index_ = rowIndex * 5 + index;

					return {
						type: MessageComponentTypes.Button,
						label: table.title,
						customId: `${buttonId}|${index_}`,
						disabled: data.inflectionTableIndex === index_,
						style: ButtonStyles.Secondary,
					};
				});

				if (buttons.length > 1) {
					paginationControls.unshift(buttons);
				}
			}
		}
	}

	const row: ButtonComponent[] = [];

	const definitionsMenuButtonId = createInteractionCollector([client, bot], {
		type: InteractionTypes.MessageComponent,
		onCollect: (_bot, selection) => {
			data.inflectionTableIndex = 0;
			data.currentView = ContentTabs.Definitions;
			return void displayMenu([client, bot], interaction, selection, data);
		},
	});

	const inflectionMenuButtonId = createInteractionCollector([client, bot], {
		type: InteractionTypes.MessageComponent,
		onCollect: (_bot, selection) => {
			data.currentView = ContentTabs.Inflection;
			return void displayMenu([client, bot], interaction, selection, data);
		},
	});

	if (entry.definitions !== undefined) {
		row.push({
			type: MessageComponentTypes.Button,
			label: localise(Commands.word.strings.definitions, interaction.locale),
			disabled: data.currentView === ContentTabs.Definitions,
			customId: definitionsMenuButtonId,
			style: ButtonStyles.Primary,
		});
	}

	if (entry.inflectionTable !== undefined) {
		row.push({
			type: MessageComponentTypes.Button,
			label: localise(Commands.word.strings.inflection, interaction.locale),
			disabled: data.currentView === ContentTabs.Inflection,
			customId: inflectionMenuButtonId,
			style: ButtonStyles.Primary,
		});
	}

	if (row.length > 1) {
		paginationControls.push(row);
	}

	// @ts-ignore: It is sure that there will be no more than 5 buttons.
	return paginationControls.map((row) => ({
		type: MessageComponentTypes.ActionRow,
		components: row,
	}));
}

function entryToEmbed(
	entry: DictionaryEntry,
	locale: string | undefined,
	verbose: boolean,
): Embed {
	const fields: DiscordEmbedField[] = [];

	if (entry.definitions !== undefined && entry.definitions.length !== 0) {
		const definitionsStringified = stringifyEntries(entry.definitions, BulletStyles.Diamond);
		const definitionsFitted = fitStringsToFieldSize(definitionsStringified, locale, verbose);

		fields.push({
			name: localise(Commands.word.strings.fields.definitions, locale),
			value: definitionsFitted,
		});
	}

	if (entry.expressions !== undefined && entry.expressions.length !== 0) {
		const expressionsStringified = stringifyEntries(entry.expressions, BulletStyles.Arrow);
		const expressionsFitted = fitStringsToFieldSize(expressionsStringified, locale, verbose);

		fields.push({
			name: localise(Commands.word.strings.fields.expressions, locale),
			value: expressionsFitted,
		});
	}

	if (entry.etymologies !== undefined && entry.etymologies.length !== 0) {
		fields.push({
			name: localise(Commands.word.strings.fields.etymology, locale),
			value: entry.etymologies.map((etymology) => {
				if (etymology.tags === undefined) {
					return `**${etymology.value}**`;
				}

				if (etymology.value === undefined) {
					return tagsToString(etymology.tags);
				}

				return `${tagsToString(etymology.tags)} **${etymology.value}**`;
			}).join('\n'),
		});
	}

	let description: string;
	if (entry.type === undefined) {
		description = localise(Words.types[WordTypes.Unknown], locale);
	} else {
		const [type, typeString] = entry.type;
		description = localise(Words.types[type], locale);
		if (type === WordTypes.Unknown) {
			description += ` — '${typeString}'`;
		}
	}

	return {
		title: entry.title ?? entry.word,
		description: `***${description}***`,
		fields,
		color: fromHex('#d6e3f8'),
	};
}

function tagsToString(tags: string[]): string {
	return tags.map((tag) => code(tag)).join(' ');
}

function stringifyEntries(entries: TaggedValue<string>[], bulletStyle: BulletStyles): string[] {
	const entriesStringified = entries.map((entry) => {
		if (entry.tags === undefined) {
			return entry.value;
		}

		return `${tagsToString(entry.tags)} ${entry.value}`;
	});
	const entriesEnlisted = list(entriesStringified, bulletStyle);
	const entriesDelisted = entriesEnlisted.split('\n');

	return entriesDelisted;
}

function fitStringsToFieldSize(
	strings: string[],
	locale: string | undefined,
	verbose: boolean,
): string {
	const overheadString = localise(Commands.word.strings.definitionsOmitted, locale)(strings.length);
	const characterOverhead = overheadString.length + 20;

	const maxCharacterCount = verbose ? 4096 : 1024;

	let characterCount = 0;
	const stringsToDisplay: string[] = [];
	for (const [string, index] of strings.map<[string, number]>((s, i) => [s, i])) {
		characterCount += string.length;

		if (characterCount + (index + 1 === strings.length ? 0 : characterOverhead) >= maxCharacterCount) break;

		stringsToDisplay.push(string);
	}

	const stringsOmitted = strings.length - stringsToDisplay.length;

	let fittedString = stringsToDisplay.join('\n');
	if (stringsOmitted !== 0) {
		const definitionsOmittedString = localise(Commands.word.strings.definitionsOmitted, locale)(stringsOmitted);
		fittedString += `\n*${definitionsOmittedString}*`;
	}

	return fittedString;
}

export default command;
