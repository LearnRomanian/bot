import {
	ApplicationCommandOptionChoice,
	ApplicationCommandOptionTypes,
	ApplicationCommandTypes,
	Bot,
	Interaction,
	Member,
} from "discordeno";
import { getActiveWarnings } from "../module.js";
import { CommandTemplate } from "../../command.js";
import { user } from "../../parameters.js";
import { logEvent } from "../../../controllers/logging/logging.js";
import { stringifyValue } from "../../../database/database.js";
import { Warning } from "../../../database/structs/warning.js";
import { Document } from "../../../database/document.js";
import { autocompleteMembers, Client, localise, resolveInteractionToMember } from "../../../client.js";
import { parseArguments, reply, respond } from "../../../interactions.js";
import constants from "../../../../constants.js";
import { mention, MentionTypes } from "../../../../formatting.js";

const command: CommandTemplate = {
	name: "pardon",
	type: ApplicationCommandTypes.ChatInput,
	defaultMemberPermissions: ["MODERATE_MEMBERS"],
	handle: handlePardonUser,
	handleAutocomplete: handlePardonUserAutocomplete,
	options: [
		user,
		{
			name: "warning",
			type: ApplicationCommandOptionTypes.String,
			required: true,
			autocomplete: true,
		},
	],
};

async function handlePardonUserAutocomplete([client, bot]: [Client, Bot], interaction: Interaction): Promise<void> {
	const [{ user, warning }, focused] = parseArguments(interaction.data?.options, {});

	if (focused?.name === "user") {
		return autocompleteMembers([client, bot], interaction, user!, {
			restrictToNonSelf: true,
			excludeModerators: true,
		});
	}

	if (focused?.name === "warning") {
		if (user === undefined) {
			return respond([client, bot], interaction, []);
		}

		const member = resolveInteractionToMember([client, bot], interaction, user, {
			restrictToNonSelf: true,
			excludeModerators: true,
		});
		if (member === undefined) {
			return respond([client, bot], interaction, []);
		}

		const relevantWarnings = await getRelevantWarnings(client, member);
		if (relevantWarnings === undefined) {
			return respond([client, bot], interaction, []);
		}

		const warningLowercase = warning!.toLowerCase();
		const choices = relevantWarnings
			.map<ApplicationCommandOptionChoice>((warning) => ({
				name: warning.data.reason,
				value: stringifyValue(warning.ref),
			}))
			.filter((choice) => choice.name.toLowerCase().includes(warningLowercase));

		return respond([client, bot], interaction, choices);
	}
}

async function handlePardonUser([client, bot]: [Client, Bot], interaction: Interaction): Promise<void> {
	const [{ user, warning }] = parseArguments(interaction.data?.options, {});
	if (user === undefined) return;

	const member = resolveInteractionToMember([client, bot], interaction, user, {
		restrictToNonSelf: true,
		excludeModerators: true,
	});
	if (member === undefined) return;

	const relevantWarnings = await getRelevantWarnings(client, member);
	if (relevantWarnings === undefined) {
		return displayFailedError([client, bot], interaction);
	}

	const warningToDelete = relevantWarnings.find((relevantWarning) => stringifyValue(relevantWarning.ref) === warning);
	if (warningToDelete === undefined) {
		return displayInvalidWarningError([client, bot], interaction);
	}

	const deletedWarning = await client.database.adapters.warnings.delete(client, warningToDelete);
	if (deletedWarning === undefined) {
		return displayFailedError([client, bot], interaction);
	}

	const guild = client.cache.guilds.get(interaction.guildId!);
	if (guild === undefined) return;

	logEvent([client, bot], guild, "memberWarnRemove", [member, deletedWarning.data, interaction.user]);

	const strings = {
		title: localise(client, "pardon.strings.pardoned.title", interaction.locale)(),
		description: localise(
			client,
			"pardon.strings.pardoned.description",
			interaction.locale,
		)({
			user_mention: mention(member.id, MentionTypes.User),
			reason: deletedWarning.data.reason,
		}),
	};

	return void reply([client, bot], interaction, {
		embeds: [
			{
				title: strings.title,
				description: strings.description,
				color: constants.colors.lightGreen,
			},
		],
	});
}
async function getRelevantWarnings(client: Client, member: Member): Promise<Document<Warning>[] | undefined> {
	const subject = await client.database.adapters.users.getOrFetchOrCreate(
		client,
		"id",
		member.id.toString(),
		member.id,
	);
	if (subject === undefined) return undefined;

	const warnings = await client.database.adapters.warnings.getOrFetch(client, "recipient", subject.ref);
	if (warnings === undefined) return undefined;

	const relevantWarnings = Array.from(getActiveWarnings(warnings).values()).reverse();
	return relevantWarnings;
}

function displayInvalidWarningError([client, bot]: [Client, Bot], interaction: Interaction): void {
	const strings = {
		title: localise(client, "pardon.strings.invalidWarning.title", interaction.locale)(),
		description: localise(client, "pardon.strings.invalidWarning.description", interaction.locale)(),
	};

	return void reply([client, bot], interaction, {
		embeds: [
			{
				title: strings.title,
				description: strings.description,
				color: constants.colors.red,
			},
		],
	});
}

function displayFailedError([client, bot]: [Client, Bot], interaction: Interaction): void {
	const strings = {
		title: localise(client, "pardon.strings.failed.title", interaction.locale)(),
		description: localise(client, "pardon.strings.failed.description", interaction.locale)(),
	};

	return void reply([client, bot], interaction, {
		embeds: [
			{
				title: strings.title,
				description: strings.description,
				color: constants.colors.red,
			},
		],
	});
}

export default command;
