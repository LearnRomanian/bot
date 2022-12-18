import {
	ApplicationCommandFlags,
	ApplicationCommandOptionTypes,
	Bot,
	Interaction,
	InteractionResponseTypes,
	sendInteractionResponse,
} from 'discordeno';
import { Commands, createLocalisations, localise } from 'logos/assets/localisations/mod.ts';
import { handleResumePlayback } from 'logos/src/commands/music/commands/resume.ts';
import { OptionBuilder } from 'logos/src/commands/command.ts';
import { Client } from 'logos/src/client.ts';
import configuration from 'logos/configuration.ts';
import { defaultLocale } from 'logos/types.ts';

const command: OptionBuilder = {
	...createLocalisations(Commands.music.options.pause),
	type: ApplicationCommandOptionTypes.SubCommand,
	handle: handlePausePlayback,
};

function handlePausePlayback(
	[client, bot]: [Client, Bot],
	interaction: Interaction,
): void {
	const musicController = client.music.get(interaction.guildId!);
	if (musicController === undefined) return;

	const [canAct, _voiceState] = musicController.verifyMemberVoiceState(interaction);
	if (!canAct) return;

	if (!musicController.isOccupied) {
		return void sendInteractionResponse(
			bot,
			interaction.id,
			interaction.token,
			{
				type: InteractionResponseTypes.ChannelMessageWithSource,
				data: {
					flags: ApplicationCommandFlags.Ephemeral,
					embeds: [{
						description: localise(Commands.music.options.pause.strings.noSongToPause, interaction.locale),
						color: configuration.messages.colors.yellow,
					}],
				},
			},
		);
	}

	if (musicController.isPaused) {
		return handleResumePlayback([client, bot], interaction);
	}

	musicController.pause();

	const pausedString = localise(Commands.music.options.pause.strings.paused.header, defaultLocale);

	return void sendInteractionResponse(
		bot,
		interaction.id,
		interaction.token,
		{
			type: InteractionResponseTypes.ChannelMessageWithSource,
			data: {
				embeds: [{
					title: `⏸️ ${pausedString}`,
					description: localise(Commands.music.options.pause.strings.paused.body, defaultLocale),
					color: configuration.messages.colors.invisible,
				}],
			},
		},
	);
}

export default command;
