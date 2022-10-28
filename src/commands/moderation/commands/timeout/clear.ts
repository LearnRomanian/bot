import {
	ApplicationCommandFlags,
	Bot,
	editMember,
	getDmChannel,
	Interaction,
	InteractionResponseTypes,
	sendInteractionResponse,
	sendMessage,
} from '../../../../../deps.ts';
import { Client, resolveInteractionToMember } from '../../../../client.ts';
import configuration from '../../../../configuration.ts';
import { diagnosticMentionUser, guildAsAuthor } from '../../../../utils.ts';
import { log } from '../../../../controllers/logging.ts';
import { localise } from '../../../../../assets/localisations/types.ts';
import { Commands } from '../../../../../assets/localisations/commands.ts';
import { defaultLanguage } from '../../../../types.ts';

async function clearTimeout(
	[client, bot]: [Client, Bot],
	interaction: Interaction,
): Promise<void> {
	const userIdentifier = <string | undefined> interaction.data?.options?.at(0)
		?.options?.at(
			0,
		)?.value;
	if (userIdentifier === undefined) return;

	const member = resolveInteractionToMember(
		[client, bot],
		interaction,
		userIdentifier,
	);
	if (!member) return;

	const timedOutUntil = member.communicationDisabledUntil;

	const notTimedOut = !timedOutUntil ||
		timedOutUntil < Date.now();

	if (notTimedOut) {
		return void sendInteractionResponse(
			bot,
			interaction.id,
			interaction.token,
			{
				type: InteractionResponseTypes.ChannelMessageWithSource,
				data: {
					flags: ApplicationCommandFlags.Ephemeral,
					embeds: [{
						description: localise(
							Commands.timeout.strings.notTimedOut,
							interaction.locale,
						),
						color: configuration.interactions.responses.colors.yellow,
					}],
				},
			},
		);
	}

	await editMember(
		bot,
		interaction.guildId!,
		member.id,
		{ communicationDisabledUntil: null },
	);

	const guild = client.cache.guilds.get(interaction.guildId!);
	if (!guild) return;

	log([client, bot], guild, 'memberTimeoutRemove', member, interaction.user);

	sendInteractionResponse(
		bot,
		interaction.id,
		interaction.token,
		{
			type: InteractionResponseTypes.ChannelMessageWithSource,
			data: {
				flags: ApplicationCommandFlags.Ephemeral,
				embeds: [{
					description: localise(
						Commands.timeout.strings.timeoutCleared,
						interaction.locale,
					)(diagnosticMentionUser(member.user!)),
					color: configuration.interactions.responses.colors.green,
				}],
			},
		},
	);

	const dmChannel = await getDmChannel(bot, member.id);
	if (!dmChannel) return;

	return void sendMessage(bot, dmChannel.id, {
		embeds: [
			{
				author: guildAsAuthor(bot, guild),
				description: localise(
					Commands.timeout.strings.timeoutClearedDirect,
					defaultLanguage,
				),
				color: configuration.interactions.responses.colors.green,
			},
		],
	});
}

export { clearTimeout };
