import type { Client } from "rost/client";

async function handleDisplayAcknowledgements(client: Client, interaction: Rost.Interaction): Promise<void> {
	const fields = constants.acknowledgements.map<Discord.Camelize<Discord.DiscordEmbedField>>((acknowledgement) => {
		const contributorsFormatted = acknowledgement.users.map((contributor) => contributor.username).join(", ");

		return {
			name: `${contributorsFormatted}:`,
			value: acknowledgement.reason,
			inline: false,
		};
	});

	const strings = constants.contexts.acknowledgements({ localise: client.localise, locale: interaction.locale });
	client.notice(interaction, { title: strings.acknowledgements, fields }).ignore();
}

export { handleDisplayAcknowledgements };
