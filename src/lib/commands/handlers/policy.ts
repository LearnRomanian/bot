import { Locale } from "logos:constants/languages";
import { Client } from "logos/client";
import { Guild } from "logos/database/guild";

async function handleDisplayModerationPolicy(client: Client, interaction: Logos.Interaction): Promise<void> {
	const locale = interaction.locale;

	const guildId = interaction.guildId;
	if (guildId === undefined) {
		return;
	}

	const guildDocument = await Guild.getOrCreate(client, { guildId: guildId.toString() });

	const configuration = guildDocument.policy;
	if (configuration === undefined) {
		return;
	}

	const guild = client.entities.guilds.get(guildId);
	if (guild === undefined) {
		return;
	}

	const strings = {
		title: client.localise("policies.moderation.title", locale)(),
	};

	const components: Discord.ActionRow[] | undefined = interaction.parameters.show
		? undefined
		: [
				{
					type: Discord.MessageComponentTypes.ActionRow,
					components: [client.interactionRepetitionService.getShowButton(interaction, { locale })],
				},
		  ];

	await client.reply(
		interaction,
		{ embeds: [{ title: strings.title, fields: getModerationPolicyPoints(client, { locale }) }], components },
		{ visible: interaction.parameters.show },
	);
}

function getModerationPolicyPoints(
	client: Client,
	{ locale }: { locale: Locale },
): Discord.CamelizedDiscordEmbedField[] {
	const strings = {
		introduction: {
			title: client.localise("policies.moderation.points.introduction.title", locale)(),
			description: client.localise("policies.moderation.points.introduction.description", locale)(),
		},
		breach: {
			title: client.localise("policies.moderation.points.breach.title", locale)(),
			description: client.localise("policies.moderation.points.breach.description", locale)(),
		},
		warnings: {
			title: client.localise("policies.moderation.points.warnings.title", locale)(),
			description: client.localise("policies.moderation.points.warnings.description", locale)(),
		},
		furtherAction: {
			title: client.localise("policies.moderation.points.furtherAction.title", locale)(),
			description: client.localise("policies.moderation.points.furtherAction.description", locale)(),
		},
		ban: {
			title: client.localise("policies.moderation.points.ban.title", locale)(),
			description: client.localise("policies.moderation.points.ban.description", locale)(),
		},
	};

	return [
		{
			name: strings.introduction.title,
			value: strings.introduction.description,
		},
		{
			name: strings.breach.title,
			value: strings.breach.description,
		},
		{
			name: strings.warnings.title,
			value: strings.warnings.description,
		},
		{
			name: strings.furtherAction.title,
			value: strings.furtherAction.description,
		},
		{
			name: strings.ban.title,
			value: strings.ban.description,
		},
	];
}

export { handleDisplayModerationPolicy };
