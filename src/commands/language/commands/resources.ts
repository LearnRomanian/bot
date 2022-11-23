import {
	ApplicationCommandFlags,
	Bot,
	ButtonStyles,
	Interaction,
	InteractionResponseTypes,
	MessageComponentTypes,
	sendInteractionResponse,
} from 'discordeno';
import { Commands, createLocalisations, localise } from 'logos/assets/localisations/mod.ts';
import { CommandBuilder, show } from 'logos/src/commands/mod.ts';
import { Client, parseArguments } from 'logos/src/mod.ts';
import { links } from 'logos/constants.ts';
import { defaultLanguage } from 'logos/types.ts';

const command: CommandBuilder = {
	...createLocalisations(Commands.resources),
	defaultMemberPermissions: ['VIEW_CHANNEL'],
	handle: resources,
	options: [show],
};

/** Displays a message with information on where to find the resources for a given language. */
function resources(
	[client, bot]: [Client, Bot],
	interaction: Interaction,
): void {
	const guild = client.cache.guilds.get(interaction.guildId!);
	if (!guild) return;

	const repositoryLink = links.generateLanguageRepositoryLink(guild.language);

	const [{ show }] = parseArguments(
		interaction.data?.options,
		{ show: 'boolean' },
	);

	return void sendInteractionResponse(
		bot,
		interaction.id,
		interaction.token,
		{
			type: InteractionResponseTypes.ChannelMessageWithSource,
			data: {
				flags: !show ? ApplicationCommandFlags.Ephemeral : undefined,
				components: [{
					type: MessageComponentTypes.ActionRow,
					components: [{
						type: MessageComponentTypes.Button,
						label: localise(
							Commands.resources.strings.resourcesStoredHere,
							show ? defaultLanguage : interaction.locale,
						)(guild.language),
						style: ButtonStyles.Link,
						url: repositoryLink,
					}],
				}],
			},
		},
	);
}

export default command;
