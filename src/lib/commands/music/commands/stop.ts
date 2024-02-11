import * as Discord from "@discordeno/bot";
import constants from "../../../../constants/constants";
import * as Logos from "../../../../types";
import { Client } from "../../../client";
import { reply } from "../../../interactions";
import { OptionTemplate } from "../../command";

const command: OptionTemplate = {
	id: "stop",
	type: Discord.ApplicationCommandOptionTypes.SubCommand,
	handle: handleStopPlayback,
};

async function handleStopPlayback(client: Client, interaction: Logos.Interaction): Promise<void> {
	const locale = interaction.guildLocale;

	const guildId = interaction.guildId;
	if (guildId === undefined) {
		return;
	}

	const musicService = client.getMusicService(guildId);
	if (musicService === undefined) {
		return;
	}

	const isVoiceStateVerified = musicService.verifyCanManagePlayback(interaction);
	if (!isVoiceStateVerified) {
		return;
	}

	const isOccupied = musicService.isOccupied;
	if (!isOccupied) {
		const locale = interaction.locale;
		const strings = {
			title: client.localise("music.strings.notPlaying.title", locale)(),
			description: {
				toManage: client.localise("music.strings.notPlaying.description.toManage", locale)(),
			},
		};

		reply(client, interaction, {
			embeds: [
				{
					title: strings.title,
					description: strings.description.toManage,
					color: constants.colors.dullYellow,
				},
			],
		});
		return;
	}

	musicService.stop();

	const strings = {
		title: client.localise("music.options.stop.strings.stopped.title", locale)(),
		description: client.localise("music.options.stop.strings.stopped.description", locale)(),
	};

	reply(
		client,
		interaction,
		{
			embeds: [
				{
					title: `${constants.symbols.music.stopped} ${strings.title}`,
					description: strings.description,
					color: constants.colors.blue,
				},
			],
		},
		{ visible: true },
	);
}

export default command;
