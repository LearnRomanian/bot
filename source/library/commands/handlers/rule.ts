import { type Rule, isValidRule } from "rost:constants/rules";
import type { Client } from "rost/client";
import { getRuleTitleFormatted } from "rost/commands/rules";

async function handleCiteRuleAutocomplete(
	client: Client,
	interaction: Rost.Interaction<any, { rule: string }>,
): Promise<void> {
	const ruleLowercase = interaction.parameters.rule.trim().toLowerCase();
	const choices = constants.rules
		.map((rule) => {
			return {
				name: getRuleTitleFormatted(client, interaction, { rule, mode: "option" }),
				value: rule,
			};
		})
		.filter((choice) => choice.name.toLowerCase().includes(ruleLowercase));

	client.respond(interaction, choices).ignore();
}

async function handleCiteRule(client: Client, interaction: Rost.Interaction<any, { rule: Rule }>): Promise<void> {
	if (!isValidRule(interaction.parameters.rule)) {
		const strings = constants.contexts.ruleInvalid({ localise: client.localise, locale: interaction.locale });
		client.error(interaction, { title: strings.title, description: strings.description }).ignore();

		return;
	}

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

	const strings = {
		...constants.contexts.tldr({
			localise: client.localise,
			locale: interaction.parameters.show ? interaction.guildLocale : interaction.locale,
		}),
		...constants.contexts.rule({
			localise: client.localise,
			locale: interaction.parameters.show ? interaction.guildLocale : interaction.locale,
		}),
	};
	client
		.notice(
			interaction,
			{
				embeds: [
					{
						title: getRuleTitleFormatted(client, interaction, {
							rule: interaction.parameters.rule,
							mode: "display",
						}),
						description: strings.content(interaction.parameters.rule),
						footer: { text: `${strings.tldr}: ${strings.summary(interaction.parameters.rule)}` },
						image: { url: constants.gifs.chaosWithoutRules },
					},
				],
				components,
			},
			{ visible: interaction.parameters.show },
		)
		.ignore();
}

export { handleCiteRule, handleCiteRuleAutocomplete };
