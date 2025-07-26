import type { Client } from "rost/client";

async function handleDisplayModerationPolicy(client: Client, interaction: Rost.Interaction): Promise<void> {
	const guild = client.entities.guilds.get(interaction.guildId);
	if (guild === undefined) {
		return;
	}

	const components: Discord.ActionRow[] | undefined = interaction.parameters.show
		? undefined
		: [
				{
					type: Discord.MessageComponentTypes.ActionRow,
					components: [client.services.global("interactionRepetition").getShowButton(interaction)],
				},
			];

	const strings = constants.contexts.moderationPolicy({ localise: client.localise, locale: interaction.locale });
	client
		.notice(
			interaction,
			{
				embeds: [
					{
						title: strings.title,
						fields: [
							{
								name: strings.points.introduction.title,
								value: strings.points.introduction.description,
							},
							{
								name: strings.points.breach.title,
								value: strings.points.breach.description,
							},
							{
								name: strings.points.warnings.title,
								value: strings.points.warnings.description,
							},
							{
								name: strings.points.furtherAction.title,
								value: strings.points.furtherAction.description,
							},
							{
								name: strings.points.ban.title,
								value: strings.points.ban.description,
							},
						],
					},
				],
				components,
			},
			{ visible: interaction.parameters.show },
		)
		.ignore();
}

export { handleDisplayModerationPolicy };
