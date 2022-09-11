import {
	ApplicationCommandFlags,
	Bot,
	ButtonStyles,
	Interaction,
	InteractionResponseTypes,
	MessageComponentTypes,
	sendInteractionResponse,
} from '../../../../deps.ts';
import { Client } from '../../../client.ts';
import { CommandBuilder } from '../../../commands/command.ts';
import { links } from '../../../constants.ts';

const command: CommandBuilder = {
	name: 'resources',
	nameLocalizations: {
		pl: 'zasoby',
		ro: 'resurse',
	},
	description: 'Displays a list of resources to learn the language.',
	descriptionLocalizations: {
		pl: 'Wyświetla listę zasób do nauki języka.',
		ro: 'Afișează o listă cu resurse pentru învățarea limbii.',
	},
	defaultMemberPermissions: ['VIEW_CHANNEL'],
	handle: resources,
};

/** Displays a message with information on where to find the resources for a given language. */
function resources(
	[client, bot]: [Client, Bot],
	interaction: Interaction,
): void {
	const guild = client.cache.guilds.get(interaction.guildId!);
	if (!guild) return;

	const repositoryLink = links.generateLanguageRepositoryLink(guild.language);

	return void sendInteractionResponse(
		bot,
		interaction.id,
		interaction.token,
		{
			type: InteractionResponseTypes.ChannelMessageWithSource,
			data: {
				flags: ApplicationCommandFlags.Ephemeral,
				components: [{
					type: MessageComponentTypes.ActionRow,
					components: [{
						type: MessageComponentTypes.Button,
						label: 'Click here for resources',
						style: ButtonStyles.Link,
						url: repositoryLink,
					}],
				}],
			},
		},
	);
}

export default command;
