import * as Discord from "@discordeno/bot";
import constants from "../../../../constants/constants";
import { Locale } from "../../../../constants/languages";
import { trim } from "../../../../formatting";
import * as Logos from "../../../../types";
import { Client, localise } from "../../../client";
import { parseArguments, parseTimeExpression, reply, respond } from "../../../interactions";
import { OptionTemplate } from "../../command";
import { timestamp } from "../../parameters";

const command: OptionTemplate = {
	name: "fast-forward",
	type: Discord.ApplicationCommandOptionTypes.SubCommand,
	handle: handleFastForward,
	handleAutocomplete: handleFastForwardAutocomplete,
	options: [timestamp],
};

async function handleFastForwardAutocomplete(
	[client, bot]: [Client, Discord.Bot],
	interaction: Logos.Interaction,
): Promise<void> {
	const language = interaction.language;
	const locale = interaction.locale;

	const [{ timestamp: timestampExpression }] = parseArguments(interaction.data?.options, {});
	if (timestampExpression === undefined) {
		return;
	}

	const timestamp = parseTimeExpression(client, timestampExpression, { language, locale });
	if (timestamp === undefined) {
		const strings = {
			autocomplete: localise(client, "autocomplete.timestamp", locale)(),
		};

		respond([client, bot], interaction, [{ name: trim(strings.autocomplete, 100), value: "" }]);
		return;
	}

	respond([client, bot], interaction, [{ name: timestamp[0], value: timestamp[1].toString() }]);
}

async function handleFastForward([client, bot]: [Client, Discord.Bot], interaction: Logos.Interaction): Promise<void> {
	const locale = interaction.guildLocale;

	const [{ timestamp: timestampExpression }] = parseArguments(interaction.data?.options, {});

	const guildId = interaction.guildId;
	if (guildId === undefined) {
		return;
	}

	const musicService = client.services.music.music.get(guildId);
	if (musicService === undefined) {
		return;
	}

	const isVoiceStateVerified = musicService.verifyCanManagePlayback(interaction);
	if (!isVoiceStateVerified) {
		return;
	}

	const [isOccupied, current, position] = [musicService.isOccupied, musicService.current, musicService.position];
	if (!isOccupied || current === undefined) {
		const locale = interaction.locale;
		const strings = {
			title: localise(client, "music.options.fast-forward.strings.noSong.title", locale)(),
			description: localise(client, "music.options.fast-forward.strings.noSong.description", locale)(),
		};

		reply([client, bot], interaction, {
			embeds: [
				{
					title: strings.title,
					description: strings.description,
					color: constants.colors.dullYellow,
				},
			],
		});
		return;
	}

	if (position === undefined) {
		return;
	}

	const timestamp = Number(timestampExpression);
	if (!Number.isSafeInteger(timestamp)) {
		displayInvalidTimestampError([client, bot], interaction, { locale });
		return;
	}

	await musicService.skipTo(Math.round((position + timestamp) / 1000) * 1000);

	const strings = {
		title: localise(client, "music.options.fast-forward.strings.fastForwarded.title", locale)(),
		description: localise(client, "music.options.fast-forward.strings.fastForwarded.description", locale)(),
	};

	reply(
		[client, bot],
		interaction,
		{
			embeds: [
				{
					title: `${constants.symbols.music.fastForwarded} ${strings.title}`,
					description: strings.description,
					color: constants.colors.blue,
				},
			],
		},
		{ visible: true },
	);
}

async function displayInvalidTimestampError(
	[client, bot]: [Client, Discord.Bot],
	interaction: Logos.Interaction,
	{ locale }: { locale: Locale },
): Promise<void> {
	const strings = {
		title: localise(client, "music.options.fast-forward.strings.invalidTimestamp.title", locale)(),
		description: localise(client, "music.options.fast-forward.strings.invalidTimestamp.description", locale)(),
	};

	reply([client, bot], interaction, {
		embeds: [{ title: strings.title, description: strings.description, color: constants.colors.red }],
	});
}

export default command;
