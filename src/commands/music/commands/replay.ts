import {
	ApplicationCommandFlags,
	ApplicationCommandOptionTypes,
	Bot,
	Interaction,
	InteractionResponseTypes,
	sendInteractionResponse,
} from 'discordeno';
import { Commands, createLocalisations, localise } from 'logos/assets/localisations/mod.ts';
import { SongListingContentTypes } from 'logos/src/commands/music/data/types.ts';
import { OptionBuilder } from 'logos/src/commands/command.ts';
import { collection } from 'logos/src/commands/parameters.ts';
import { Client } from 'logos/src/client.ts';
import { parseArguments } from 'logos/src/utils.ts';
import configuration from 'logos/configuration.ts';

const command: OptionBuilder = {
	...createLocalisations(Commands.music.options.replay),
	type: ApplicationCommandOptionTypes.SubCommand,
	handle: handleReplayAction,
	options: [collection],
};

function handleReplayAction(
	[client, bot]: [Client, Bot],
	interaction: Interaction,
): void {
	const musicController = client.music.get(interaction.guildId!);
	if (musicController === undefined) return;

	const [canAct, _voiceState] = musicController.verifyMemberVoiceState(interaction);
	if (!canAct) return;

	const [{ collection }] = parseArguments(interaction.data?.options, { collection: 'boolean' });

	const currentListing = musicController.current;

	if (!musicController.isOccupied || currentListing === undefined) {
		return void sendInteractionResponse(
			bot,
			interaction.id,
			interaction.token,
			{
				type: InteractionResponseTypes.ChannelMessageWithSource,
				data: {
					flags: ApplicationCommandFlags.Ephemeral,
					embeds: [{
						description: localise(Commands.music.options.replay.strings.noSongToReplay, interaction.locale),
						color: configuration.messages.colors.yellow,
					}],
				},
			},
		);
	}

	if (
		collection !== undefined &&
		currentListing.content.type !== SongListingContentTypes.Collection
	) {
		return void sendInteractionResponse(
			bot,
			interaction.id,
			interaction.token,
			{
				type: InteractionResponseTypes.ChannelMessageWithSource,
				data: {
					flags: ApplicationCommandFlags.Ephemeral,
					embeds: [{
						description: localise(Commands.music.options.replay.strings.noSongCollectionToReplay, interaction.locale),
						color: configuration.messages.colors.yellow,
					}],
				},
			},
		);
	}

	return musicController.replay(interaction, collection);
}

export default command;
