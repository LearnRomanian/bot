import type { Translation } from "rost:constants/contributions";
import type { Client } from "rost/client";

async function handleDisplayCredits(client: Client, interaction: Rost.Interaction): Promise<void> {
	client.notice(interaction, getTranslationView(client, interaction)).ignore();
}

function getTranslationView(client: Client, interaction: Rost.Interaction): Discord.Camelize<Discord.DiscordEmbed> {
	const fields: Discord.Camelize<Discord.DiscordEmbedField>[] = [];

	const strings = constants.contexts.credits({ localise: client.localise, locale: interaction.locale });
	for (const [language, data] of (
		Object.entries(constants.contributions.translation) as [string, Translation][]
	).sort(([_, a], [__, b]) => b.completion - a.completion)) {
		const contributorsFormatted = data.contributors
			.map((contributor) => {
				if (contributor.link !== undefined) {
					return `[${contributor.username}](${contributor.link})`;
				}

				return `${contributor.username}`;
			})
			.map((contributor) => `- ${contributor}`)
			.join("\n");

		fields.push({
			name: `${data.flag} ${language} (${data.completion * 10}%)`,
			value: contributorsFormatted,
			inline: true,
		});
	}

	return { title: strings.translation, fields };
}

export { handleDisplayCredits };
