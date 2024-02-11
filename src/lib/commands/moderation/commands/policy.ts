import * as Discord from "@discordeno/bot";
import { Locale } from "../../../../constants/languages";
import * as Logos from "../../../../types";
import { Client } from "../../../client";
import { Guild } from "../../../database/guild";
import { getShowButton, parseArguments, reply } from "../../../interactions";
import { CommandTemplate } from "../../command";
import { show } from "../../parameters";

const command: CommandTemplate = {
	id: "policy",
	type: Discord.ApplicationCommandTypes.ChatInput,
	defaultMemberPermissions: ["VIEW_CHANNEL"],
	handle: handleDisplayModerationPolicy,
	options: [show],
	flags: {
		isShowable: true,
	},
};

async function handleDisplayModerationPolicy(client: Client, interaction: Logos.Interaction): Promise<void> {
	const locale = interaction.locale;

	const guildId = interaction.guildId;
	if (guildId === undefined) {
		return;
	}

	const session = client.database.openSession();

	const guildDocument =
		client.documents.guilds.get(guildId.toString()) ??
		(await session.get<Guild>(`guilds/${guildId}`).then((value) => value ?? undefined));

	session.dispose();

	if (guildDocument === undefined) {
		return;
	}

	const configuration = guildDocument.features.moderation.features?.policy;
	if (configuration === undefined || !configuration.enabled) {
		return;
	}

	const [{ show: showParameter }] = parseArguments(interaction.data?.options, { show: "boolean" });

	const show = interaction.show ?? showParameter ?? false;

	const guild = client.entities.guilds.get(guildId);
	if (guild === undefined) {
		return;
	}

	const strings = {
		title: client.localise("policies.moderation.title", locale)(),
	};

	const showButton = getShowButton(client, interaction, { locale });

	const components: Discord.ActionRow[] | undefined = show
		? undefined
		: [{ type: Discord.MessageComponentTypes.ActionRow, components: [showButton] }];

	reply(
		client,
		interaction,
		{ embeds: [{ title: strings.title, fields: getModerationPolicyPoints(client, { locale }) }], components },
		{ visible: show },
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

export default command;
