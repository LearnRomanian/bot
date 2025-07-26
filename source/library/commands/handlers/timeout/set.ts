import { mention, timestamp, trim } from "rost:constants/formatting";
import type { Client } from "rost/client";
import { parseTimeExpression } from "rost/commands/interactions";
import { Guild } from "rost/models/guild";

async function handleSetTimeoutAutocomplete(
	client: Client,
	interaction: Rost.Interaction<any, { user: string; duration: string }>,
): Promise<void> {
	if (interaction.parameters.focused === undefined) {
		return;
	}

	switch (interaction.parameters.focused) {
		case "user": {
			await client.autocompleteMembers(interaction, {
				identifier: interaction.parameters.user,
				options: { restrictToNonSelf: true, excludeModerators: true },
			});

			return;
		}
		case "duration": {
			const timestamp = parseTimeExpression(client, interaction, interaction.parameters.duration);
			if (timestamp === undefined) {
				const strings = constants.contexts.autocompleteTimestamp({
					localise: client.localise,
					locale: interaction.locale,
				});
				client.respond(interaction, [{ name: trim(strings.autocomplete, 100), value: "" }]).ignore();

				return;
			}

			client.respond(interaction, [{ name: timestamp[0], value: timestamp[1].toString() }]).ignore();
		}
	}
}

async function handleSetTimeout(
	client: Client,
	interaction: Rost.Interaction<any, { user: string; duration: string; reason: string }>,
): Promise<void> {
	const guildDocument = await Guild.getOrCreate(client, { guildId: interaction.guildId.toString() });

	const member = client.resolveInteractionToMember(interaction, {
		identifier: interaction.parameters.user,
		options: {
			restrictToNonSelf: true,
			excludeModerators: true,
		},
	});
	if (member === undefined) {
		return;
	}

	let durationParsed = Number(interaction.parameters.duration);
	if (!Number.isSafeInteger(durationParsed)) {
		const timestamp = parseTimeExpression(client, interaction, interaction.parameters.duration);
		if (timestamp === undefined) {
			const strings = constants.contexts.timeoutDurationInvalid({
				localise: client.localise,
				locale: interaction.locale,
			});
			client.error(interaction, { title: strings.title, description: strings.description }).ignore();

			return;
		}

		durationParsed = timestamp[1];
	}

	if (durationParsed < constants.time.minute) {
		const strings = constants.contexts.timeoutDurationTooShort({
			localise: client.localise,
			locale: interaction.locale,
		});
		client.warning(interaction, { title: strings.title, description: strings.description }).ignore();

		return;
	}

	if (durationParsed > constants.time.week) {
		const strings = constants.contexts.timeoutDurationTooLong({
			localise: client.localise,
			locale: interaction.locale,
		});
		client.warning(interaction, { title: strings.title, description: strings.description }).ignore();

		return;
	}

	const until = Date.now() + durationParsed;

	const guild = client.entities.guilds.get(interaction.guildId);
	if (guild === undefined) {
		return;
	}

	await client.bot.helpers
		.editMember(interaction.guildId, member.id, { communicationDisabledUntil: new Date(until).toISOString() })
		.catch((error) => client.log.warn(error, `Failed to time ${client.diagnostics.member(member)} out.`));

	await client.tryLog("memberTimeoutAdd", {
		guildId: guild.id,
		journalling: guildDocument.isJournalled("timeouts"),
		args: [member, until, interaction.parameters.reason, interaction.user],
	});

	const strings = constants.contexts.timedOut({ localise: client.localise, locale: interaction.locale });
	client
		.notice(interaction, {
			title: strings.title,
			description: strings.description({
				user_mention: mention(member.id, { type: "user" }),
				relative_timestamp: timestamp(until, { format: "relative" }),
			}),
		})
		.ignore();
}

export { handleSetTimeout, handleSetTimeoutAutocomplete };
