import constants from "../../../../constants/constants";
import { defaultLocale } from "../../../../constants/language";
import defaults from "../../../../defaults";
import { MentionTypes, mention, trim } from "../../../../formatting";
import { Client, localise } from "../../../client";
import {
	ControlButtonID,
	acknowledge,
	createInteractionCollector,
	decodeId,
	deleteReply,
	editReply,
	generateButtons,
	reply,
} from "../../../interactions";
import { MusicService } from "../../../services/music/music";
import { chunk } from "../../../utils";
import { OptionTemplate } from "../../command";
import { SongListing, listingTypeToEmoji } from "../data/types";
import * as Discord from "discordeno";

const command: OptionTemplate = {
	name: "remove",
	type: Discord.ApplicationCommandOptionTypes.SubCommand,
	handle: handleRemoveSongListing,
};

async function handleRemoveSongListing(
	[client, bot]: [Client, Discord.Bot],
	interaction: Discord.Interaction,
): Promise<void> {
	const guildId = interaction.guildId;
	if (guildId === undefined) {
		return;
	}

	const musicService = client.services.music.music.get(guildId);
	if (musicService === undefined) {
		return;
	}

	const isVoiceStateVerified = musicService.verifyCanManagePlayback(bot, interaction);
	if (isVoiceStateVerified === undefined || !isVoiceStateVerified) {
		return;
	}

	const [events, isQueueEmpty] = [musicService.events, musicService.isQueueEmpty];
	if (events === undefined || isQueueEmpty === undefined) {
		return;
	}

	if (isQueueEmpty) {
		const strings = {
			title: localise(client, "music.options.remove.strings.queueEmpty.description", interaction.locale)(),
			description: localise(client, "music.options.remove.strings.queueEmpty.description", interaction.locale)(),
		};

		reply([client, bot], interaction, {
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

	const removeListingData = { pageIndex: 0 };

	const interactionResponseData = await generateEmbed(
		[client, bot],
		interaction,
		musicService,
		removeListingData,
		interaction.locale,
	);
	if (interactionResponseData === undefined) {
		return;
	}

	const onQueueUpdateListener = async () => {
		const interactionResponseData = await generateEmbed(
			[client, bot],
			interaction,
			musicService,
			removeListingData,
			interaction.locale,
		);
		if (interactionResponseData !== undefined) {
			editReply([client, bot], interaction, interactionResponseData);
		}
	};

	const onStopListener = async () => deleteReply([client, bot], interaction);

	events.on("queueUpdate", onQueueUpdateListener);
	events.on("stop", onStopListener);

	setTimeout(() => {
		events.off("queueUpdate", onQueueUpdateListener);
		events.off("stop", onStopListener);
	}, constants.INTERACTION_TOKEN_EXPIRY);

	reply([client, bot], interaction, interactionResponseData);
}

interface RemoveListingData {
	pageIndex: number;
}

async function generateEmbed(
	[client, bot]: [Client, Discord.Bot],
	interaction: Discord.Interaction,
	musicService: MusicService,
	data: RemoveListingData,
	locale: string | undefined,
): Promise<Discord.InteractionCallbackData | undefined> {
	const queue = musicService.queue;
	if (queue === undefined) {
		return undefined;
	}

	const pages = chunk(queue, defaults.RESULTS_PER_PAGE);

	const isFirst = data.pageIndex === 0;
	const isLast = data.pageIndex === pages.length - 1;

	const buttonsCustomId = createInteractionCollector([client, bot], {
		type: Discord.InteractionTypes.MessageComponent,
		userId: interaction.user.id,
		onCollect: async (bot, selection) => {
			acknowledge([client, bot], selection);

			const customId = selection.data?.customId;
			if (customId === undefined) {
				return;
			}

			const [_, action] = decodeId<ControlButtonID>(customId);

			switch (action) {
				case "previous": {
					if (!isFirst) {
						data.pageIndex--;
					}
					break;
				}
				case "next": {
					if (!isLast) {
						data.pageIndex++;
					}
					break;
				}
			}

			const interactionResponseData = await generateEmbed([client, bot], interaction, musicService, data, locale);
			if (interactionResponseData === undefined) {
				return;
			}

			editReply([client, bot], interaction, interactionResponseData);
		},
	});

	const selectMenuCustomId = createInteractionCollector([client, bot], {
		type: Discord.InteractionTypes.MessageComponent,
		userId: interaction.user.id,
		limit: 1,
		onCollect: async (bot, selection) => {
			const indexString = selection.data?.values?.at(0) as string | undefined;
			if (indexString === undefined) {
				return;
			}

			const index = Number(indexString);
			if (isNaN(index)) {
				return;
			}

			const songListing = musicService.remove(index);
			if (songListing === undefined) {
				const strings = {
					title: localise(client, "music.options.remove.strings.failed.title", interaction.locale)(),
					description: localise(client, "music.options.remove.strings.failed.description", interaction.locale)(),
				};

				reply([client, bot], selection, {
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

			const strings = {
				title: localise(client, "music.options.remove.strings.removed.title", defaultLocale)(),
				description: localise(
					client,
					"music.options.remove.strings.removed.description",
					defaultLocale,
				)({
					title: songListing.content.title,
					user_mention: mention(selection.user.id, MentionTypes.User),
				}),
			};

			reply(
				[client, bot],
				selection,
				{
					embeds: [
						{
							title: `${constants.symbols.music.removed} ${strings.title}`,
							description: strings.description,
							color: constants.colors.blue,
						},
					],
				},
				{ visible: true },
			);
		},
	});

	if (pages.at(0)?.length === 0) {
		const strings = {
			title: localise(client, "music.options.remove.strings.queueEmpty.title", locale)(),
			description: localise(client, "music.options.remove.strings.queueEmpty.description", locale)(),
		};

		return {
			embeds: [
				{
					title: strings.title,
					description: strings.description,
					color: constants.colors.blue,
				},
			],
			components: [],
		};
	}

	const strings = {
		title: localise(client, "music.options.remove.strings.selectSong.title", locale)(),
		description: localise(client, "music.options.remove.strings.selectSong.description", locale)(),
		continuedOnNextPage: localise(client, "interactions.continuedOnNextPage", locale)(),
	};

	return {
		embeds: [
			{
				title: strings.title,
				description: strings.description,
				color: constants.colors.blue,
				footer: isLast ? undefined : { text: strings.continuedOnNextPage },
			},
		],
		components: [
			generateSelectMenu(data, pages, selectMenuCustomId),
			...generateButtons(buttonsCustomId, isFirst, isLast),
		],
	};
}

function generateSelectMenu(
	data: RemoveListingData,
	pages: SongListing[][],
	selectMenuCustomId: string,
): Discord.ActionRow {
	const page = pages.at(data.pageIndex);
	if (page === undefined) {
		return {
			type: Discord.MessageComponentTypes.ActionRow,
			components: [
				{
					type: Discord.MessageComponentTypes.SelectMenu,
					customId: selectMenuCustomId,
					minValues: 1,
					maxValues: 1,
					options: [{ label: "?", value: constants.components.none }],
				},
			],
		};
	}

	return {
		type: Discord.MessageComponentTypes.ActionRow,
		components: [
			{
				type: Discord.MessageComponentTypes.SelectMenu,
				customId: selectMenuCustomId,
				minValues: 1,
				maxValues: 1,
				options: page.map<Discord.SelectOption>((songListing, index) => ({
					emoji: { name: listingTypeToEmoji[songListing.content.type] },
					label: trim(songListing.content.title, 100),
					value: (data.pageIndex * defaults.RESULTS_PER_PAGE + index).toString(),
				})),
			},
		],
	};
}

export default command;
