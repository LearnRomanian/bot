type AutocompleteInteraction = (Discord.Interaction | Rost.Interaction) & {
	type: Discord.InteractionTypes.ApplicationCommandAutocomplete;
};

function isAutocomplete(
	interaction: Omit<Discord.Interaction, "bot"> | Rost.Interaction,
): interaction is AutocompleteInteraction {
	return interaction.type === Discord.InteractionTypes.ApplicationCommandAutocomplete;
}

function isSubcommandGroup(option: Discord.InteractionDataOption): boolean {
	return option.type === Discord.ApplicationCommandOptionTypes.SubCommandGroup;
}

function isSubcommand(option: Discord.InteractionDataOption): boolean {
	return option.type === Discord.ApplicationCommandOptionTypes.SubCommand;
}

export { isAutocomplete, isSubcommand, isSubcommandGroup };
