import { Locale } from "logos:constants/languages";
import { Rule, isValidRule } from "logos:constants/rules";
import { Client } from "logos/client";
import { Guild } from "logos/database/guild";

async function handleCiteRuleAutocomplete(
	client: Client,
	interaction: Logos.Interaction<any, { rule: string }>,
): Promise<void> {
	const guildId = interaction.guildId;
	if (guildId === undefined) {
		return;
	}

	const guildDocument = await Guild.getOrCreate(client, { guildId: guildId.toString() });

	const configuration = guildDocument.warns;
	if (configuration === undefined) {
		return;
	}

	const locale = interaction.locale;

	const ruleLowercase = interaction.parameters.rule.trim().toLowerCase();
	const choices = constants.rules
		.map((rule) => {
			return {
				name: getRuleTitleFormatted(client, rule, "option", { locale }),
				value: rule,
			};
		})
		.filter((choice) => choice.name.toLowerCase().includes(ruleLowercase));

	await client.respond(interaction, choices);
}

async function handleCiteRule(client: Client, interaction: Logos.Interaction<any, { rule: Rule }>): Promise<void> {
	const locale = interaction.parameters.show ? interaction.guildLocale : interaction.locale;

	if (!isValidRule(interaction.parameters.rule)) {
		await displayError(client, interaction, { locale: interaction.locale });
		return;
	}

	const guildId = interaction.guildId;
	if (guildId === undefined) {
		return;
	}

	const guild = client.entities.guilds.get(guildId);
	if (guild === undefined) {
		return;
	}

	const strings = {
		tldr: client.localise("rules.tldr", locale)(),
		summary: client.localise(`rules.${interaction.parameters.rule}.summary`, locale)(),
		content: client.localise(`rules.${interaction.parameters.rule}.content`, locale)(),
	};

	const components: Discord.ActionRow[] | undefined = interaction.parameters.show
		? undefined
		: [
				{
					type: Discord.MessageComponentTypes.ActionRow,
					components: [client.interactionRepetitionService.getShowButton(interaction, { locale })],
				},
		  ];

	await client.notice(
		interaction,
		{
			embeds: [
				{
					title: getRuleTitleFormatted(client, interaction.parameters.rule, "display", { locale }),
					description: strings.content,
					footer: { text: `${strings.tldr}: ${strings.summary}` },
					image: { url: constants.gifs.chaosWithoutRules },
				},
			],
			components,
		},
		{ visible: interaction.parameters.show },
	);
}

// TODO(vxern): This shouldn't be in the handler file.
function getRuleTitleFormatted(
	client: Client,
	rule: Rule | "other",
	mode: "option" | "display",
	{ locale }: { locale: Locale },
): string {
	const index = isValidRule(rule) ? constants.rules.indexOf(rule) : undefined;

	const strings = {
		title: client.localise(`rules.${rule}.title`, locale)(),
		summary: client.localise(`rules.${rule}.summary`, locale)(),
	};

	switch (mode) {
		case "option":
			return `#${index !== undefined ? index + 1 : "?"} ${strings.title} ~ ${strings.summary}`;
		case "display":
			return `${index !== undefined ? index + 1 : "?"} - ${strings.title}`;
	}
}

async function displayError(
	client: Client,
	interaction: Logos.Interaction,
	{ locale }: { locale: Locale },
): Promise<void> {
	const strings = {
		title: client.localise("rule.strings.invalid.title", locale)(),
		description: client.localise("rule.strings.invalid.description", locale)(),
	};

	await client.error(interaction, {
		title: strings.title,
		description: strings.description,
	});
}

export { handleCiteRule, handleCiteRuleAutocomplete, getRuleTitleFormatted };
