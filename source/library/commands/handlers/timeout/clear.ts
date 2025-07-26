import { mention } from "rost:constants/formatting";
import type { Client } from "rost/client";
import { Guild } from "rost/models/guild";

async function handleClearTimeoutAutocomplete(
	client: Client,
	interaction: Rost.Interaction<any, { user: string }>,
): Promise<void> {
	await client.autocompleteMembers(interaction, {
		identifier: interaction.parameters.user,
		options: { restrictToNonSelf: true, excludeModerators: true },
	});
}

async function handleClearTimeout(client: Client, interaction: Rost.Interaction<any, { user: string }>): Promise<void> {
	const guildDocument = await Guild.getOrCreate(client, { guildId: interaction.guildId.toString() });

	const member = client.resolveInteractionToMember(interaction, {
		identifier: interaction.parameters.user,
		options: { restrictToNonSelf: true, excludeModerators: true },
	});
	if (member === undefined) {
		return;
	}

	const user = member.user;
	if (user === undefined) {
		return;
	}

	const timedOutUntil = member.communicationDisabledUntil ?? undefined;

	const notTimedOut = timedOutUntil === undefined || timedOutUntil < Date.now();
	if (notTimedOut) {
		const strings = constants.contexts.notTimedOut({ localise: client.localise, locale: interaction.locale });
		client
			.warning(interaction, {
				title: strings.title,
				description: strings.description({ user_mention: mention(user.id, { type: "user" }) }),
			})
			.ignore();

		return;
	}

	const guild = client.entities.guilds.get(interaction.guildId);
	if (guild === undefined) {
		return;
	}

	await client.bot.helpers
		.editMember(interaction.guildId, member.id, { communicationDisabledUntil: null })
		.catch((error) => client.log.warn(error, `Failed to remove timeout of ${client.diagnostics.member(member)}.`));

	await client.tryLog("memberTimeoutRemove", {
		guildId: guild.id,
		journalling: guildDocument.isJournalled("timeouts"),
		args: [member, interaction.user],
	});

	const strings = constants.contexts.timeoutCleared({
		localise: client.localise,
		locale: interaction.locale,
	});
	client
		.success(interaction, {
			title: strings.title,
			description: strings.description({ user_mention: mention(user.id, { type: "user" }) }),
		})
		.ignore();
}

export { handleClearTimeout, handleClearTimeoutAutocomplete };
