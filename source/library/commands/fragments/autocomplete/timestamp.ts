import { trim } from "rost:constants/formatting";
import type { Client } from "rost/client";
import { parseTimeExpression } from "rost/commands/interactions";

async function handleAutocompleteTimestamp(
	client: Client,
	interaction: Rost.Interaction<any, { timestamp: string }>,
): Promise<void> {
	const timestamp = parseTimeExpression(client, interaction, interaction.parameters.timestamp);
	if (timestamp === undefined) {
		const strings = constants.contexts.autocompleteTimestamp({
			localise: client.localise,
			locale: interaction.locale,
		});
		client.respond(interaction, [{ name: trim(strings.autocomplete, 100), value: "" }]).ignore();

		return;
	}

	client.respond(interaction, [{ name: timestamp[0], value: timestamp[1].toString() }]).ignore();
}

export { handleAutocompleteTimestamp };
