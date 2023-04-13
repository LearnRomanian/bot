import { Bot, editMember, Interaction } from 'discordeno';
import { logEvent } from 'logos/src/controllers/logging/logging.ts';
import { autocompleteMembers, Client, localise, resolveInteractionToMember } from 'logos/src/client.ts';
import { parseArguments, parseTimeExpression, reply, respond } from 'logos/src/interactions.ts';
import constants, { Periods } from 'logos/constants.ts';
import { mention, MentionTypes, timestamp } from 'logos/formatting.ts';

async function handleSetTimeoutAutocomplete([client, bot]: [Client, Bot], interaction: Interaction): Promise<void> {
	const [{ user, duration }, focused] = parseArguments(interaction.data?.options, {});

	switch (focused!.name) {
		case 'user': {
			return autocompleteMembers(
				[client, bot],
				interaction,
				user!,
				{ restrictToNonSelf: true, excludeModerators: true },
			);
		}
		case 'duration': {
			const timestamp = parseTimeExpression(client, duration!, interaction.locale);
			if (timestamp === undefined) {
				return respond([client, bot], interaction, []);
			}

			return respond([client, bot], interaction, [{ name: timestamp[0], value: timestamp[1].toString() }]);
		}
	}
}

async function handleSetTimeout([client, bot]: [Client, Bot], interaction: Interaction): Promise<void> {
	const [{ user, duration, reason }] = parseArguments(interaction.data?.options, {});
	if (user === undefined || duration === undefined) return;

	const member = resolveInteractionToMember([client, bot], interaction, user!, {
		restrictToNonSelf: true,
		excludeModerators: true,
	});
	if (member === undefined) return;

	const durationParsed = Number(duration);

	if (Number.isNaN(duration)) {
		return displayDurationInvalidError([client, bot], interaction);
	}

	if (durationParsed < Periods.minute) {
		return displayTooShortWarning([client, bot], interaction);
	}

	if (durationParsed > Periods.week) {
		return displayTooLongWarning([client, bot], interaction);
	}

	const until = Date.now() + durationParsed;

	const guild = client.cache.guilds.get(interaction.guildId!);
	if (guild === undefined) return;

	await editMember(bot, interaction.guildId!, member.id, { communicationDisabledUntil: until });

	logEvent([client, bot], guild, 'memberTimeoutAdd', [member, until, reason!, interaction.user]);

	const strings = {
		title: localise(client, 'timeout.strings.timedOut.title', interaction.locale)(),
		description: localise(client, 'timeout.strings.timedOut.description', interaction.locale)(
			{
				'user_mention': mention(member.id, MentionTypes.User),
				'relative_timestamp': timestamp(until),
			},
		),
	};

	return void reply([client, bot], interaction, {
		embeds: [{
			title: strings.title,
			description: strings.description,
			color: constants.colors.blue,
		}],
	});
}

function displayDurationInvalidError([client, bot]: [Client, Bot], interaction: Interaction): void {
	const strings = {
		title: localise(client, 'timeout.strings.durationInvalid.title', interaction.locale)(),
		description: localise(client, 'timeout.strings.durationInvalid.description', interaction.locale)(),
	};

	return void reply([client, bot], interaction, {
		embeds: [{ title: strings.title, description: strings.description, color: constants.colors.darkRed }],
	});
}

function displayTooShortWarning([client, bot]: [Client, Bot], interaction: Interaction): void {
	const strings = {
		title: localise(client, 'timeout.strings.tooShort.title', interaction.locale)(),
		description: localise(client, 'timeout.strings.tooShort.description', interaction.locale)(),
	};

	return void reply([client, bot], interaction, {
		embeds: [{ title: strings.title, description: strings.description, color: constants.colors.yellow }],
	});
}

function displayTooLongWarning([client, bot]: [Client, Bot], interaction: Interaction): void {
	const strings = {
		title: localise(client, 'timeout.strings.tooLong.title', interaction.locale)(),
		description: localise(client, 'timeout.strings.tooLong.description', interaction.locale)(),
	};

	return void reply([client, bot], interaction, {
		embeds: [{ title: strings.title, description: strings.description, color: constants.colors.yellow }],
	});
}

export { handleSetTimeout, handleSetTimeoutAutocomplete };
