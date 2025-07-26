import { mention } from "rost:constants/formatting";
import { timeStructToMilliseconds } from "rost:constants/time";
import type { Client } from "rost/client";
import { Guild } from "rost/models/guild";
import { Warning } from "rost/models/warning";

async function handlePardonUserAutocomplete(
	client: Client,
	interaction: Rost.Interaction<any, { user: string; warning: string }>,
): Promise<void> {
	const guildDocument = await Guild.getOrCreate(client, { guildId: interaction.guildId.toString() });
	const configuration = guildDocument.feature("warns");

	if (interaction.parameters.focused === undefined) {
		return;
	}

	switch (interaction.parameters.focused) {
		case "user": {
			await client.autocompleteMembers(interaction, {
				identifier: interaction.parameters.user,
				options: {
					restrictToNonSelf: true,
					excludeModerators: true,
				},
			});
			break;
		}
		case "warning": {
			const member = client.resolveInteractionToMember(interaction, {
				identifier: interaction.parameters.user,
				options: {
					restrictToNonSelf: true,
					excludeModerators: true,
				},
			});
			if (member === undefined) {
				client.respond(interaction, []).ignore();
				return;
			}

			const warningDocumentsActive = await Warning.getActiveWarnings(client, {
				guildId: interaction.guildId.toString(),
				targetId: member.id.toString(),
				timeRangeMilliseconds: timeStructToMilliseconds(
					configuration.expiration ?? constants.defaults.WARN_EXPIRY,
				),
			});

			const warningLowercase = interaction.parameters.warning.toLowerCase();
			const choices = warningDocumentsActive
				.map<Discord.ApplicationCommandOptionChoice>((warning) => ({
					name: warning.reason,
					value: warning.partialId,
				}))
				.filter((choice) => choice.name.toLowerCase().includes(warningLowercase));
			client.respond(interaction, choices).ignore();

			break;
		}
	}
}

async function handlePardonUser(
	client: Client,
	interaction: Rost.Interaction<any, { user: string; warning: string }>,
): Promise<void> {
	const guildDocument = await Guild.getOrCreate(client, { guildId: interaction.guildId.toString() });
	const configuration = guildDocument.feature("warns");

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

	const warningDocumentsActive = await Warning.getActiveWarnings(client, {
		guildId: interaction.guildId.toString(),
		targetId: member.id.toString(),
		timeRangeMilliseconds: timeStructToMilliseconds(configuration.expiration ?? constants.defaults.WARN_EXPIRY),
	});

	const warningDocument = warningDocumentsActive.find(
		(warningDocument) => warningDocument.partialId === interaction.parameters.warning,
	);
	if (warningDocument === undefined) {
		const strings = constants.contexts.invalidWarning({ localise: client.localise, locale: interaction.locale });
		await client.error(interaction, { title: strings.title, description: strings.description });

		return;
	}

	await warningDocument.delete(client);

	const guild = client.entities.guilds.get(interaction.guildId);
	if (guild === undefined) {
		return;
	}

	await client.tryLog("memberWarnRemove", {
		guildId: guild.id,
		journalling: guildDocument.isJournalled("warns"),
		args: [member, warningDocument, interaction.user],
	});

	const strings = constants.contexts.pardoned({ localise: client.localise, locale: interaction.locale });
	client
		.success(interaction, {
			title: strings.title,
			description: strings.description({
				user_mention: mention(member.id, { type: "user" }),
				reason: warningDocument.reason,
			}),
		})
		.ignore();
}

export { handlePardonUser, handlePardonUserAutocomplete };
