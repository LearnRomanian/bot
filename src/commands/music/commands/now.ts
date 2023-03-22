import {
	ApplicationCommandFlags,
	ApplicationCommandOptionTypes,
	Bot,
	Interaction,
	InteractionResponseTypes,
	sendInteractionResponse,
} from 'discordeno';
import { Song, SongStream } from 'logos/src/commands/music/data/types.ts';
import { OptionTemplate } from 'logos/src/commands/command.ts';
import { collection, show } from 'logos/src/commands/parameters.ts';
import { isCollection, isOccupied } from 'logos/src/controllers/music.ts';
import { Client, localise } from 'logos/src/client.ts';
import { paginate, parseArguments } from 'logos/src/interactions.ts';
import { chunk } from 'logos/src/utils.ts';
import configuration from 'logos/configuration.ts';
import constants from 'logos/constants.ts';
import { mention, MentionTypes, timestamp, trim } from 'logos/formatting.ts';
import { defaultLocale } from 'logos/types.ts';

const command: OptionTemplate = {
	name: 'now',
	type: ApplicationCommandOptionTypes.SubCommand,
	handle: handleDisplayCurrentlyPlaying,
	options: [collection, show],
};

function handleDisplayCurrentlyPlaying([client, bot]: [Client, Bot], interaction: Interaction): void {
	const [{ collection, show }] = parseArguments(interaction.data?.options, { collection: 'boolean', show: 'boolean' });

	const controller = client.features.music.controllers.get(interaction.guildId!);
	if (controller === undefined) return;

	const currentListing = controller.currentListing;

	if (!isOccupied(controller.player) || currentListing === undefined) {
		return void sendInteractionResponse(
			bot,
			interaction.id,
			interaction.token,
			{
				type: InteractionResponseTypes.ChannelMessageWithSource,
				data: {
					flags: ApplicationCommandFlags.Ephemeral,
					embeds: [{
						description: localise(client, 'music.options.now.strings.noSongPlaying', interaction.locale)(),
						color: constants.colors.dullYellow,
					}],
				},
			},
		);
	}

	const locale = show ? defaultLocale : interaction.locale;

	const noCollectionPlayingString = localise(
		client,
		'music.options.now.strings.noCollectionPlaying',
		interaction.locale,
	)();
	const requestInformationAboutSongString = localise(
		client,
		'music.options.now.strings.requestInformationAboutSong',
		interaction.locale,
	)();

	if (collection !== undefined) {
		if (!isCollection(currentListing?.content)) {
			return void sendInteractionResponse(
				bot,
				interaction.id,
				interaction.token,
				{
					type: InteractionResponseTypes.ChannelMessageWithSource,
					data: {
						flags: ApplicationCommandFlags.Ephemeral,
						embeds: [{
							description: `${noCollectionPlayingString}\n\n${requestInformationAboutSongString}`,
							color: constants.colors.dullYellow,
						}],
					},
				},
			);
		}

		const collection = currentListing.content;

		const nowPlayingString = localise(client, 'music.options.now.strings.nowPlaying', locale)();

		return void paginate([client, bot], interaction, {
			elements: chunk(collection.songs, configuration.music.limits.songs.page),
			embed: {
				title: `${constants.symbols.music.nowPlaying} ${nowPlayingString}`,
				color: constants.colors.blue,
			},
			view: {
				title: localise(client, 'music.options.now.strings.songs', locale)(),
				generate: (songs, pageIndex) =>
					songs.length !== 0
						? songs.map((song, index) => {
							const isCurrent = pageIndex * 10 + index === collection.position;

							const titleFormatted = trim(
								song.title
									.replaceAll('(', '❨')
									.replaceAll(')', '❩')
									.replaceAll('[', '⁅')
									.replaceAll(']', '⁆'),
								50,
							);
							const titleHyperlink = `[${titleFormatted}](${song.url})`;
							const titleHighlighted = isCurrent ? `**${titleHyperlink}**` : titleHyperlink;

							return `${pageIndex * 10 + (index + 1)}. ${titleHighlighted}`;
						}).join('\n')
						: localise(client, 'music.strings.listEmpty', locale)(),
			},
			show: show ?? false,
		});
	}

	const song = currentListing.content as Song | SongStream;

	const nowPlayingString = localise(client, 'music.options.now.strings.nowPlaying', locale)();

	return void sendInteractionResponse(
		bot,
		interaction.id,
		interaction.token,
		{
			type: InteractionResponseTypes.ChannelMessageWithSource,
			data: {
				flags: !show ? ApplicationCommandFlags.Ephemeral : undefined,
				embeds: [{
					title: `${constants.symbols.music.nowPlaying} ${nowPlayingString}`,
					fields: [
						...isCollection(currentListing?.content)
							? [{
								name: localise(client, 'music.options.now.strings.collection', locale)(),
								value: currentListing.content.title,
							}, {
								name: localise(client, 'music.options.now.strings.track', locale)(),
								value: `${currentListing.content.position + 1}/${currentListing.content.songs.length}`,
							}]
							: [],
						{
							name: localise(client, 'music.options.now.strings.title', locale)(),
							value: `[${song.title}](${song.url})`,
							inline: false,
						},
						{
							name: localise(client, 'music.options.now.strings.requestedBy', locale)(),
							value: mention(currentListing.requestedBy, MentionTypes.User),
							inline: false,
						},
						{
							name: localise(client, 'music.options.now.strings.runningTime', locale)(),
							value: (controller.player.playingSince ?? undefined) !== undefined
								? localise(client, 'music.options.now.strings.playingSince', locale)(
									{ 'relative_timestamp': timestamp(controller.player.playingSince!) },
								)
								: localise(client, 'music.options.now.strings.startTimeUnknown', locale)(),
							inline: false,
						},
					],
					footer: {
						text: localise(client, 'music.options.now.strings.sourcedFrom', locale)(
							{
								'source': currentListing.source ?? localise(client, 'music.options.now.strings.theInternet', locale)(),
							},
						),
					},
				}],
			},
		},
	);
}

export default command;
