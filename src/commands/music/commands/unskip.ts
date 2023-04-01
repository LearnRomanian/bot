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
import {
	getVoiceState,
	isCollection,
	isOccupied,
	isQueueVacant,
	unskip,
	verifyCanManipulatePlayback,
} from 'logos/src/controllers/music.ts';
import { Client, localise } from 'logos/src/client.ts';
import { parseArguments } from 'logos/src/interactions.ts';
import constants from 'logos/constants.ts';
import { defaultLocale } from 'logos/types.ts';

const command: OptionTemplate = {
	name: 'unskip',
	type: ApplicationCommandOptionTypes.SubCommand,
	handle: handleUnskipAction,
	options: [collection, by, to],
};

function handleUnskipAction([client, bot]: [Client, Bot], interaction: Interaction): void {
	const [{ collection, by: songsToUnskip, to: songToUnskipTo }] = parseArguments(
		interaction.data?.options,
		{ collection: 'boolean', by: 'number', to: 'number' },
	);

	if (songsToUnskip !== undefined && isNaN(songsToUnskip)) return;
	if (songToUnskipTo !== undefined && isNaN(songToUnskipTo)) return;

	const controller = client.features.music.controllers.get(interaction.guildId!);
	if (controller === undefined) return;

	const isVoiceStateVerified = verifyCanManipulatePlayback(
		[client, bot],
		interaction,
		controller,
		getVoiceState(client, interaction.guildId!, interaction.user.id),
	);
	if (!isVoiceStateVerified) return;

	const isUnskippingListing = (() => {
		if (controller.currentListing === undefined) return true;
		if (!isCollection(controller.currentListing?.content)) return true;
		if (collection !== undefined || controller.currentListing!.content.position === 0) return true;

		return false;
	})();

	if (isUnskippingListing && controller.listingHistory.length === 0) {
		const strings = {
			nowhereToUnskipTo: localise(client, 'music.options.unskip.strings.nowhereToUnskipTo', interaction.locale)(),
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
						description: strings.nowhereToUnskipTo,
						color: constants.colors.dullYellow,
					}],
				},
			},
		);
	}

	if (
		collection !== undefined &&
		(controller.currentListing?.content === undefined || !isCollection(controller.currentListing?.content))
	) {
		const strings = {
			noSongCollectionToUnskip: localise(
				client,
				'music.options.unskip.strings.noSongCollectionToUnskip',
				interaction.locale,
			)(),
			tryUnskippingSong: localise(
				client,
				'music.options.unskip.strings.tryUnskippingSong',
				interaction.locale,
			)(),
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
						description: `${strings.noSongCollectionToUnskip}\n\n${strings.tryUnskippingSong}`,
						color: constants.colors.dullYellow,
					}],
				},
			},
		);
	}

	if (isOccupied(controller.player) && !isQueueVacant(controller.listingQueue)) {
		const strings = {
			cannotUnskipDueToFullQueue: localise(
				client,
				'music.options.unskip.strings.cannotUnskipDueToFullQueue',
				interaction.locale,
			)(),
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
						description: strings.cannotUnskipDueToFullQueue,
						color: constants.colors.red,
					}],
				},
			},
		);
	}

	// If both the 'to' and the 'by' parameter have been supplied.
	if (songsToUnskip !== undefined && songToUnskipTo !== undefined) {
		const strings = {
			tooManySkipArguments: localise(client, 'music.strings.tooManySkipArguments', interaction.locale)(),
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
						description: strings.tooManySkipArguments,
						color: constants.colors.red,
					}],
				},
			},
		);
	}

	// If either the 'to' parameter or the 'by' parameter are negative.
	if ((songsToUnskip !== undefined && songsToUnskip <= 0) || (songToUnskipTo !== undefined && songToUnskipTo <= 0)) {
		const strings = {
			mustBeGreaterThanZero: localise(client, 'music.strings.mustBeGreaterThanZero', interaction.locale)(),
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
						description: strings.mustBeGreaterThanZero,
						color: constants.colors.red,
					}],
				},
			},
		);
	}

	const isUnskippingCollection = collection ?? false;

	if (isUnskippingListing) {
		unskip([client, bot], interaction.guildId!, controller, isUnskippingCollection, {
			by: songsToUnskip,
			to: songToUnskipTo,
		});
	} else {
		if (songsToUnskip !== undefined) {
			let listingsToUnskip!: number;
			if (
				controller.currentListing?.content !== undefined && isCollection(controller.currentListing.content) &&
				collection === undefined
			) {
				listingsToUnskip = Math.min(songsToUnskip, controller.currentListing!.content.position);
			} else {
				listingsToUnskip = Math.min(songsToUnskip, controller.listingHistory.length);
			}
			unskip([client, bot], interaction.guildId!, controller, isUnskippingCollection, { by: listingsToUnskip });
		} else if (songToUnskipTo !== undefined) {
			let listingToSkipTo!: number;
			if (
				controller.currentListing?.content !== undefined && isCollection(controller.currentListing.content) &&
				collection === undefined
			) {
				listingToSkipTo = Math.max(songToUnskipTo, 1);
			} else {
				listingToSkipTo = Math.min(songToUnskipTo, controller.listingHistory.length);
			}
			unskip([client, bot], interaction.guildId!, controller, isUnskippingCollection, { to: listingToSkipTo });
		} else {
			unskip([client, bot], interaction.guildId!, controller, isUnskippingCollection, {});
		}
	}

	const strings = {
		title: localise(client, 'music.options.unskip.strings.unskipped.title', defaultLocale)(),
		description: localise(client, 'music.options.unskip.strings.unskipped.description', defaultLocale)(),
	};

	return void sendInteractionResponse(
		bot,
		interaction.id,
		interaction.token,
		{
			type: InteractionResponseTypes.ChannelMessageWithSource,
			data: {
				embeds: [{
					title: `${constants.symbols.music.unskipped} ${strings.title}`,
					description: strings.description,
					color: constants.colors.invisible,
				}],
			},
		},
	);
}

export default command;
