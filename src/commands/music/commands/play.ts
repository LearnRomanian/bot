import { OptionBuilder } from '../../../commands/command.ts';
import configuration from '../../../configuration.ts';
import { ListingResolver, sources } from '../data/sources/sources.ts';
import { query } from '../parameters.ts';
import { Client } from '../../../client.ts';
import {
	ApplicationCommandOptionTypes,
	Bot,
	Interaction,
	InteractionResponseTypes,
	sendInteractionResponse,
} from '../../../../deps.ts';
import { SongListingContentTypes } from '../data/song-listing.ts';
import {
	createLocalisations,
	localise,
} from '../../../../assets/localisations/types.ts';
import { Commands } from '../../../../assets/localisations/commands.ts';

const command: OptionBuilder = {
	...createLocalisations(Commands.music.options.play),
	type: ApplicationCommandOptionTypes.SubCommandGroup,
	options: [
		{
			...createLocalisations(Commands.music.options.play.options.file),
			type: ApplicationCommandOptionTypes.SubCommand,
			handle: playStream,
			options: [{
				...createLocalisations(
					Commands.music.options.play.options.file.options.url,
				),
				type: ApplicationCommandOptionTypes.String,
				required: true,
			}],
		},
		...Object.entries(sources).map<OptionBuilder>(([name, resolve]) => ({
			...createLocalisations(Commands.music.options.play.options.source(name)),
			type: ApplicationCommandOptionTypes.SubCommand,
			handle: ([client, bot], interaction) =>
				playSongListing([client, bot], interaction, resolve),
			options: [query],
		})),
	],
};

function playStream(
	clientWithBot: [Client, Bot],
	interaction: Interaction,
): Promise<void> {
	return playSongListing(
		clientWithBot,
		interaction,
		(_client, interaction, query) =>
			new Promise((resolve) =>
				resolve({
					requestedBy: interaction.user.id,
					content: {
						type: SongListingContentTypes.External,
						title: localise(
							Commands.music.options.play.strings.externalFile,
							interaction.locale,
						),
						url: query,
					},
				})
			),
	);
}

async function playSongListing(
	[client, bot]: [Client, Bot],
	interaction: Interaction,
	resolveToSongListing: ListingResolver,
): Promise<void> {
	const musicController = client.music.get(interaction.guildId!);
	if (!musicController) return;

	const titleOrUrl = <string | undefined> interaction.data?.options?.at(0)
		?.options?.at(0)?.options?.at(0)?.value;
	if (!titleOrUrl) return;

	const [canPlay, voiceState] = musicController.verifyCanPlay(interaction);
	if (!canPlay || !voiceState) return;

	const songListing = await resolveToSongListing(
		client,
		interaction,
		titleOrUrl,
	);

	if (!songListing) {
		return void sendInteractionResponse(
			bot,
			interaction.id,
			interaction.token,
			{
				type: InteractionResponseTypes.ChannelMessageWithSource,
				data: {
					embeds: [{
						description: localise(
							Commands.music.options.play.strings.songNotFound,
							interaction.locale,
						),
						color: configuration.interactions.responses.colors.red,
					}],
				},
			},
		);
	}

	const textChannel = client.cache.channels.get(interaction.channelId!);
	if (!textChannel) return;

	const voiceChannel = client.cache.channels.get(voiceState.channelId!);
	if (!voiceChannel) return;

	return void musicController.play(client, {
		interaction: interaction,
		songListing: songListing,
		channels: { text: textChannel, voice: voiceChannel },
	});
}

export { playSongListing };
export default command;
