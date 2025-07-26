import type { Client } from "rost/client";
import { Guild } from "rost/models/guild";

/** Displays a message with information on where to find the resources for a given language. */
async function handleDisplayResources(client: Client, interaction: Rost.Interaction): Promise<void> {
	const guildDocument = await Guild.getOrCreate(client, { guildId: interaction.guildId.toString() });
	const configuration = guildDocument.feature("resources");

	const strings = constants.contexts.redirect({
		localise: client.localise,
		locale: interaction.parameters.show ? interaction.guildLocale : interaction.locale,
	});

	const buttons: Discord.ButtonComponent[] = [
		{
			type: Discord.MessageComponentTypes.Button,
			label: strings.redirect,
			style: Discord.ButtonStyles.Link,
			url: configuration.url,
		},
	];

	if (!interaction.parameters.show) {
		buttons.push(client.services.global("interactionRepetition").getShowButton(interaction));
	}

	client
		.reply(
			interaction,
			{
				components: [
					{
						type: Discord.MessageComponentTypes.ActionRow,
						components: buttons as [Discord.ButtonComponent],
					},
				],
			},
			{ visible: interaction.parameters.show },
		)
		.ignore();
}

export { handleDisplayResources };
