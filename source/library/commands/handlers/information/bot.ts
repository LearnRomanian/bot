import { list } from "rost:constants/formatting";
import type { Client } from "rost/client";

async function handleDisplayBotInformation(client: Client, interaction: Rost.Interaction): Promise<void> {
	const botUser = client.entities.users.get(client.bot.id);
	if (botUser === undefined) {
		return;
	}

	const guild = client.entities.guilds.get(interaction.guildId);
	if (guild === undefined) {
		return;
	}

	const strings = constants.contexts.botInformation({ localise: client.localise, locale: interaction.displayLocale });

	const featuresFormatted = list([
		`${constants.emojis.commands.information.bot.features.information} ${strings.function.features.information}`,
		`${constants.emojis.commands.information.bot.features.moderation} ${strings.function.features.moderation}`,
		`${constants.emojis.commands.information.bot.features.roles} ${strings.function.features.roles}`,
		`${constants.emojis.commands.information.bot.features.music} ${strings.function.features.music}`,
		`${constants.emojis.commands.information.bot.features.social} ${strings.function.features.social}`,
	]);

	client
		.notice(
			interaction,
			{
				embeds: [
					{
						author: {
							iconUrl: Discord.avatarUrl(client.bot.id, botUser.discriminator, {
								avatar: botUser.avatar ?? undefined,
								format: "png",
							}),
							name: botUser.username,
						},
						fields: [
							{
								name: `${constants.emojis.commands.information.bot.features.bot} ${strings.concept.title}`,
								value: strings.concept.description({ server_name: guild.name }),
							},
							{
								name: `${constants.emojis.commands.information.bot.features.function} ${strings.function.title}`,
								value: `${strings.function.description}\n${featuresFormatted}`,
							},
						],
					},
				],
				components: interaction.parameters.show
					? []
					: [
							{
								type: Discord.MessageComponentTypes.ActionRow,
								components: [
									client.services.global("interactionRepetition").getShowButton(interaction),
								],
							},
						],
			},
			{ visible: interaction.parameters.show },
		)
		.ignore();
}

export { handleDisplayBotInformation };
