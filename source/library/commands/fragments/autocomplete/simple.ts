import type { Client } from "rost/client";

async function handleSimpleAutocomplete<T>(
	client: Client,
	interaction: Rost.Interaction,
	{
		query,
		elements,
		getOption,
	}: { query: string; elements: T[]; getOption: (element: T) => Discord.ApplicationCommandOptionChoice },
): Promise<void> {
	const queryLowercase = query.trim().toLowerCase();
	const choices = elements
		.map((element) => getOption(element))
		.filter((choice) => choice.name.toLowerCase().includes(queryLowercase))
		.slice(0, constants.discord.MAXIMUM_AUTOCOMPLETE_CHOICES);

	client.respond(interaction, choices).ignore();
}

export { handleSimpleAutocomplete };
