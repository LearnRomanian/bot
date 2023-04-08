import {
	ApplicationCommandFlags,
	ApplicationCommandOptionTypes,
	Bot,
	Interaction,
	InteractionResponseTypes,
	sendInteractionResponse,
} from 'discordeno';
import { OptionTemplate } from 'logos/src/commands/command.ts';
import { by, collection, to } from 'logos/src/commands/parameters.ts';
import { getVoiceState, isCollection, isOccupied, skip, verifyCanManagePlayback } from 'logos/src/controllers/music.ts';
import { Client, localise } from 'logos/src/client.ts';
import { parseArguments } from 'logos/src/interactions.ts';
import constants from 'logos/constants.ts';
import { defaultLocale } from 'logos/types.ts';

const command: OptionTemplate = {
	name: 'skip',
	type: ApplicationCommandOptionTypes.SubCommand,
	handle: handleSkipAction,
	options: [collection, by, to],
};

function handleSkipAction([client, bot]: [Client, Bot], interaction: Interaction): void {
	const [{ collection, by: songsToSkip, to: songToSkipTo }] = parseArguments(
		interaction.data?.options,
		{ collection: 'boolean', by: 'number', to: 'number' },
	);
	if (songsToSkip !== undefined && isNaN(songsToSkip)) return;
	if (songToSkipTo !== undefined && isNaN(songToSkipTo)) return;

	const controller = client.features.music.controllers.get(interaction.guildId!);
	if (controller === undefined) return;

	const isVoiceStateVerified = verifyCanManagePlayback(
		[client, bot],
		interaction,
		controller,
		getVoiceState(client, interaction.guildId!, interaction.user.id),
	);
	if (!isVoiceStateVerified) return;

	if (!isOccupied(controller.player) || controller.currentListing === undefined) {
		const strings = {
			title: localise(client, 'music.options.skip.strings.noSong.title', interaction.locale)(),
			description: localise(client, 'music.options.skip.strings.noSong.description', interaction.locale)(),
		};

		return void sendInteractionResponse(
			bot,
			interaction.id,
			interaction.token,
			{
				type: InteractionResponseTypes.ChannelMessageWithSource,
				data: {
					flags: ApplicationCommandFlags.Ephemeral,
					embeds: [{
						title: strings.title,
						description: strings.description,
						color: constants.colors.dullYellow,
					}],
				},
			},
		);
	}

	if (collection !== undefined && !isCollection(controller.currentListing?.content)) {
		const strings = {
			title: localise(client, 'music.options.skip.strings.noSongCollection.title', interaction.locale)(),
			description: {
				noSongCollection: localise(
					client,
					'music.options.skip.strings.noSongCollection.description.noSongCollection',
					interaction.locale,
				)(),
				trySongInstead: localise(
					client,
					'music.options.skip.strings.noSongCollection.description.trySongInstead',
					interaction.locale,
				)(),
			},
		};

		return void sendInteractionResponse(
			bot,
			interaction.id,
			interaction.token,
			{
				type: InteractionResponseTypes.ChannelMessageWithSource,
				data: {
					flags: ApplicationCommandFlags.Ephemeral,
					embeds: [{
						title: strings.title,
						description: `${strings.description.noSongCollection}\n\n${strings.description.trySongInstead}`,
						color: constants.colors.dullYellow,
					}],
				},
			},
		);
	}

	// If both the 'to' and the 'by' parameter have been supplied.
	if (songsToSkip !== undefined && songToSkipTo !== undefined) {
		const strings = {
			title: localise(client, 'music.strings.skips.tooManyArguments.title', interaction.locale)(),
			description: localise(client, 'music.strings.skips.tooManyArguments.description', interaction.locale)(),
		};

		return void sendInteractionResponse(
			bot,
			interaction.id,
			interaction.token,
			{
				type: InteractionResponseTypes.ChannelMessageWithSource,
				data: {
					flags: ApplicationCommandFlags.Ephemeral,
					embeds: [{
						title: strings.title,
						description: strings.description,
						color: constants.colors.red,
					}],
				},
			},
		);
	}

	// If either the 'to' parameter or the 'by' parameter are negative.
	if ((songsToSkip !== undefined && songsToSkip <= 0) || (songToSkipTo !== undefined && songToSkipTo <= 0)) {
		const strings = {
			title: localise(client, 'music.strings.skips.invalid.title', interaction.locale)(),
			description: localise(client, 'music.strings.skips.invalid.description', interaction.locale)(),
		};

		return void sendInteractionResponse(
			bot,
			interaction.id,
			interaction.token,
			{
				type: InteractionResponseTypes.ChannelMessageWithSource,
				data: {
					flags: ApplicationCommandFlags.Ephemeral,
					embeds: [{
						title: strings.title,
						description: strings.description,
						color: constants.colors.red,
					}],
				},
			},
		);
	}

	const isSkippingCollection = collection ?? false;

	if (songsToSkip !== undefined) {
		let listingsToSkip!: number;
		if (isCollection(controller.currentListing?.content) && collection === undefined) {
			listingsToSkip = Math.min(
				songsToSkip,
				controller.currentListing!.content.songs.length - (controller.currentListing!.content.position + 1),
			);
		} else {
			listingsToSkip = Math.min(songsToSkip, controller.listingQueue.length);
		}
		skip(controller, isSkippingCollection, { by: listingsToSkip });
	} else if (songToSkipTo !== undefined) {
		let listingToSkipTo!: number;
		if (isCollection(controller.currentListing?.content) && collection === undefined) {
			listingToSkipTo = Math.min(songToSkipTo, controller.currentListing!.content.songs.length);
		} else {
			listingToSkipTo = Math.min(songToSkipTo, controller.listingQueue.length);
		}
		skip(controller, isSkippingCollection, { to: listingToSkipTo });
	} else {
		skip(controller, isSkippingCollection, {});
	}

	const strings = collection ?? false
		? {
			title: localise(client, 'music.options.skip.strings.skippedSongCollection.title', defaultLocale)(),
			description: localise(client, 'music.options.skip.strings.skippedSongCollection.description', defaultLocale)(),
		}
		: {
			title: localise(client, 'music.options.skip.strings.skippedSong.title', defaultLocale)(),
			description: localise(client, 'music.options.skip.strings.skippedSong.description', defaultLocale)(),
		};

	return void sendInteractionResponse(
		bot,
		interaction.id,
		interaction.token,
		{
			type: InteractionResponseTypes.ChannelMessageWithSource,
			data: {
				embeds: [{
					title: `${constants.symbols.music.skipped} ${strings.title}`,
					description: strings.description,
					color: constants.colors.invisible,
				}],
			},
		},
	);
}

export default command;
