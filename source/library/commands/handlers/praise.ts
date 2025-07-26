import { mention } from "rost:constants/formatting";
import type { Client } from "rost/client";
import { Guild } from "rost/models/guild";
import { Praise } from "rost/models/praise";

async function handlePraiseUserAutocomplete(
	client: Client,
	interaction: Rost.Interaction<any, { user: string }>,
): Promise<void> {
	await client.autocompleteMembers(interaction, { identifier: interaction.parameters.user });
}

async function handlePraiseUser(
	client: Client,
	interaction: Rost.Interaction<any, { user: string; comment: string | undefined }>,
): Promise<void> {
	const member = client.resolveInteractionToMember(interaction, { identifier: interaction.parameters.user });
	if (member === undefined) {
		return;
	}

	if (member.id === interaction.member?.id) {
		const strings = constants.contexts.cannotPraiseSelf({ localise: client.localise, locale: interaction.locale });
		client.warning(interaction, { title: strings.title, description: strings.description }).ignore();

		return;
	}

	await client.postponeReply(interaction);

	const guildDocument = await Guild.getOrCreate(client, { guildId: interaction.guildId.toString() });
	const crossesRateLimit = Guild.crossesRateLimit(
		await Praise.getAll(client, {
			where: { guildId: interaction.guildId.toString(), authorId: interaction.user.id.toString() },
		}),
		guildDocument.rateLimit("praises") ?? constants.defaults.PRAISE_RATE_LIMIT,
	);
	if (crossesRateLimit) {
		const strings = constants.contexts.tooManyPraises({ localise: client.localise, locale: interaction.locale });
		client.pushedBack(interaction, { title: strings.title, description: strings.description }).ignore();

		return;
	}

	const guild = client.entities.guilds.get(interaction.guildId);
	if (guild === undefined) {
		return;
	}

	const praiseDocument = await Praise.create(client, {
		guildId: interaction.guildId.toString(),
		authorId: interaction.user.id.toString(),
		targetId: member.id.toString(),
		comment: interaction.parameters.comment,
	});

	await client.tryLog("praiseAdd", {
		guildId: guild.id,
		journalling: guildDocument.isJournalled("praises"),
		args: [member, praiseDocument, interaction.user],
	});

	const strings = constants.contexts.praised({ localise: client.localise, locale: interaction.locale });
	client
		.succeeded(interaction, {
			title: strings.title,
			description: strings.description({ user_mention: mention(member.id, { type: "user" }) }),
		})
		.ignore();
}

export { handlePraiseUser, handlePraiseUserAutocomplete };
