import {
	ApplicationCommandFlags,
	Bot,
	ButtonStyles,
	Guild,
	Interaction,
	InteractionResponseTypes,
	MessageComponentTypes,
	sendInteractionResponse,
	sendMessage,
} from 'discordeno';
import { Commands, localise } from 'logos/assets/localisations/mod.ts';
import { Client } from 'logos/src/client.ts';
import { fromHex, getTextChannel } from 'logos/src/utils.ts';
import configuration from 'logos/configuration.ts';
import { mention, MentionTypes } from 'logos/formatting.ts';
import { staticComponentIds } from 'logos/constants.ts';
import { defaultLanguage } from 'logos/types.ts';

function handlePostWelcomeMessage(
	[client, bot]: [Client, Bot],
	interaction: Interaction,
): void {
	const guild = client.cache.guilds.get(interaction.guildId!);
	if (guild === undefined) return;

	sendMessage(bot, interaction.channelId!, {
		embeds: [{
			title: localise(Commands.post.options.welcome.strings.welcome.header, defaultLanguage)(guild.name),
			description: localise(Commands.post.options.welcome.strings.welcome.body, defaultLanguage)(
				getChannelMention(guild, 'rules'),
			),
			color: fromHex('#f28123'),
		}],
		components: [{
			type: MessageComponentTypes.ActionRow,
			components: [{
				type: MessageComponentTypes.Button,
				style: ButtonStyles.Secondary,
				label: localise(Commands.post.options.welcome.strings.acceptedRules, defaultLanguage),
				customId: staticComponentIds.acceptedRules,
				emoji: { name: '✅' },
			}],
		}],
	});

	return void sendInteractionResponse(
		bot,
		interaction.id,
		interaction.token,
		{
			type: InteractionResponseTypes.ChannelMessageWithSource,
			data: {
				flags: ApplicationCommandFlags.Ephemeral,
				embeds: [{
					description: localise(Commands.post.options.welcome.strings.posted, interaction.locale),
					color: configuration.messages.colors.blue,
				}],
			},
		},
	);
}

function getChannelMention(guild: Guild, name: string): string {
	const channel = getTextChannel(guild, name);
	if (channel === undefined) return name;

	return mention(channel.id, MentionTypes.Channel);
}

export { handlePostWelcomeMessage };
