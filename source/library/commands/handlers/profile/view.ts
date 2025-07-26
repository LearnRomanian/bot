import { mention } from "rost:constants/formatting";
import type { Client } from "rost/client";
import { Praise } from "rost/models/praise";
import { Warning } from "rost/models/warning";

async function handleDisplayProfileAutocomplete(
	client: Client,
	interaction: Rost.Interaction<any, { user: string }>,
): Promise<void> {
	await client.autocompleteMembers(interaction, { identifier: interaction.parameters.user });
}

async function handleDisplayProfile(
	client: Client,
	interaction: Rost.Interaction<any, { user: string | undefined }>,
): Promise<void> {
	const member = client.resolveInteractionToMember(interaction, {
		identifier: interaction.parameters.user ?? interaction.user.id.toString(),
	});
	if (member === undefined) {
		return;
	}

	const target = member.user;
	if (target === undefined) {
		return;
	}

	const [praiseDocumentsByAuthor, praiseDocumentsByTarget, warningDocuments] = await Promise.all([
		Praise.getAll(client, { where: { guildId: interaction.guildId.toString(), authorId: member.id.toString() } }),
		Praise.getAll(client, { where: { guildId: interaction.guildId.toString(), targetId: member.id.toString() } }),
		Warning.getAll(client, { where: { guildId: interaction.guildId.toString(), targetId: member.id.toString() } }),
	]);

	const strings = constants.contexts.profile({ localise: client.localise, locale: interaction.locale });
	const components: Discord.ActionRow[] | undefined = interaction.parameters.show
		? undefined
		: [
				{
					type: Discord.MessageComponentTypes.ActionRow,
					components: [client.services.global("interactionRepetition").getShowButton(interaction)],
				},
			];

	client
		.notice(
			interaction,
			{
				title: strings.title({ username: target.username }),
				thumbnail: (() => {
					const iconURL = Discord.avatarUrl(target.id, target.discriminator, {
						avatar: target.avatar,
						size: 4096,
						format: "webp",
					});
					if (iconURL === undefined) {
						return undefined;
					}

					return { url: iconURL };
				})(),
				fields: [
					{
						name: `${constants.emojis.commands.profile.view.roles} ${strings.roles}`,
						value: member.roles.map((roleId) => mention(roleId, { type: "role" })).join(" "),
						inline: false,
					},
					{
						name: `${constants.emojis.commands.profile.view.statistics} ${strings.statistics}`,
						value: `${constants.emojis.commands.profile.view.praises} ${strings.praises} • ${strings.received} – ${praiseDocumentsByTarget.length} • ${strings.sent} – ${praiseDocumentsByAuthor.length}
  ${constants.emojis.commands.profile.view.warnings} ${strings.warnings} • ${strings.received} – ${warningDocuments.length}`,
						inline: false,
					},
				],
				components,
			},
			{ visible: interaction.parameters.show },
		)
		.ignore();
}

export { handleDisplayProfile, handleDisplayProfileAutocomplete };
