import {
	ApplicationCommandFlags,
	ApplicationCommandOptionTypes,
	Bot,
	Interaction,
	InteractionResponseTypes,
	InteractionTypes,
	sendInteractionResponse,
} from 'discordeno';
import { Commands, createLocalisations, Information, localise } from 'logos/assets/localisations/mod.ts';
import { CommandBuilder } from 'logos/src/commands/command.ts';
import { Client } from 'logos/src/client.ts';
import { parseArguments } from 'logos/src/utils.ts';
import configuration from 'logos/configuration.ts';
import { defaultLocale } from 'logos/types.ts';

const command: CommandBuilder = {
	...createLocalisations(Commands.rule),
	defaultMemberPermissions: ['VIEW_CHANNEL'],
	handle: handleCiteRule,
	options: [{
		...createLocalisations(Commands.rule.options.rule),
		type: ApplicationCommandOptionTypes.String,
		required: true,
		autocomplete: true,
	}],
};

function handleCiteRule(
	[client, bot]: [Client, Bot],
	interaction: Interaction,
): void {
	if (interaction.type === InteractionTypes.ApplicationCommandAutocomplete) {
		const choices = Object.values(Information.rules.rules).map((rule, indexZeroBased) => {
			const index = indexZeroBased + 1;
			const titleWithTLDR = localise(rule.title, interaction.locale);

			return {
				name: `#${index}: ${titleWithTLDR}`,
				value: indexZeroBased.toString(),
			};
		});

		return void sendInteractionResponse(
			bot,
			interaction.id,
			interaction.token,
			{
				type: InteractionResponseTypes.ApplicationCommandAutocompleteResult,
				data: { choices },
			},
		);
	}

	const [{ rule }] = parseArguments(
		interaction.data?.options,
		{ rule: 'number' },
	);
	if (rule === undefined) return displayInvalidRuleError(bot, interaction);

	const ruleParsed = Object.values(Information.rules.rules).at(rule);
	if (ruleParsed === undefined) return displayInvalidRuleError(bot, interaction);

	const guild = client.cache.guilds.get(interaction.guildId!);
	if (guild === undefined) return;

	const ruleString = localise(Information.rules.rule, defaultLocale);
	const ruleTitleString = localise(ruleParsed.title, defaultLocale);
	const tldrString = localise(Information.rules.tldr, defaultLocale);
	const summaryString = localise(ruleParsed.summary, defaultLocale);

	return void sendInteractionResponse(
		bot,
		interaction.id,
		interaction.token,
		{
			type: InteractionResponseTypes.ChannelMessageWithSource,
			data: {
				embeds: [{
					title: `${ruleString} #${rule + 1}: ${ruleTitleString} ~ ${tldrString}: *${summaryString}*`,
					description: localise(ruleParsed.content, defaultLocale),
					color: configuration.messages.colors.blue,
				}],
			},
		},
	);
}

function displayInvalidRuleError(bot: Bot, interaction: Interaction): void {
	return void sendInteractionResponse(
		bot,
		interaction.id,
		interaction.token,
		{
			type: InteractionResponseTypes.ChannelMessageWithSource,
			data: {
				flags: ApplicationCommandFlags.Ephemeral,
				embeds: [{
					description: localise(Commands.rule.strings.invalidRule, interaction.locale),
					color: configuration.messages.colors.red,
				}],
			},
		},
	);
}

export default command;
