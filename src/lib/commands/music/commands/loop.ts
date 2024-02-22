import * as Discord from "@discordeno/bot";
import constants from "../../../../constants/constants";
import * as Logos from "../../../../types";
import { Client } from "../../../client";
import { isCollection } from "../../../services/music/music";
import { OptionTemplate } from "../../command";
import { collection } from "../../parameters";

const command: OptionTemplate = {
	id: "loop",
	type: Discord.ApplicationCommandOptionTypes.SubCommand,
	handle: handleLoopPlayback,
	options: [collection],
};

async function handleLoopPlayback(
	client: Client,
	interaction: Logos.Interaction<any, { collection: boolean | undefined }>,
): Promise<void> {
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

	const [current, isOccupied] = [musicService.current, musicService.isOccupied];
	if (!isOccupied) {
		const locale = interaction.locale;
		const strings = {
			title: client.localise("music.strings.notPlaying.title", locale)(),
			description: {
				toManage: client.localise("music.strings.notPlaying.description.toManage", locale)(),
			},
		};

		client.reply(interaction, {
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

	if (interaction.parameters.collection) {
		if (current?.content === undefined || !isCollection(current.content)) {
			const locale = interaction.locale;
			const strings = {
				title: client.localise("music.options.loop.strings.noSongCollection.title", locale)(),
				description: {
					noSongCollection: client.localise(
						"music.options.loop.strings.noSongCollection.description.noSongCollection",
						locale,
					)(),
					trySongInstead: client.localise(
						"music.options.loop.strings.noSongCollection.description.trySongInstead",
						locale,
					)(),
				},
			};

			client.reply(interaction, {
				embeds: [
					{
						title: strings.title,
						description: `${strings.description.noSongCollection}\n\n${strings.description.trySongInstead}`,
						color: constants.colors.dullYellow,
					},
				],
			});
			return;
		}
	} else if (current?.content === undefined) {
		const locale = interaction.locale;
		const strings = {
			title: client.localise("music.options.loop.strings.noSong.title", locale)(),
			description: client.localise("music.options.loop.strings.noSong.description", locale)(),
		};

		client.reply(interaction, {
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

	if (interaction.parameters.collection) {
		const isLooped = musicService.loop(true);
		if (isLooped === undefined) {
			return;
		}

		if (!isLooped) {
			const strings = {
				title: client.localise("music.options.loop.strings.disabled.title", locale)(),
				description: client.localise("music.options.loop.strings.disabled.description.songCollection", locale)(),
			};

			client.reply(
				interaction,
				{
					embeds: [
						{
							title: `${constants.symbols.music.loopDisabled} ${strings.title}`,
							description: strings.description,
							color: constants.colors.blue,
						},
					],
				},
				{ visible: true },
			);
			return;
		}

		const strings = {
			title: client.localise("music.options.loop.strings.enabled.title", locale)(),
			description: client.localise("music.options.loop.strings.enabled.description.songCollection", locale)(),
		};

		client.reply(
			interaction,
			{
				embeds: [
					{
						title: `${constants.symbols.music.loopEnabled} ${strings.title}`,
						description: strings.description,
						color: constants.colors.blue,
					},
				],
			},
			{ visible: true },
		);
		return;
	}

	const isLooped = musicService.loop(false);
	if (isLooped === undefined) {
		return;
	}

	if (!isLooped) {
		const strings = {
			title: client.localise("music.options.loop.strings.disabled.title", locale)(),
			description: client.localise("music.options.loop.strings.disabled.description.song", locale)(),
		};

		client.reply(
			interaction,
			{
				embeds: [
					{
						title: `${constants.symbols.music.loopDisabled} ${strings.title}`,
						description: strings.description,
						color: constants.colors.blue,
					},
				],
			},
			{ visible: true },
		);
		return;
	}

	const strings = {
		title: client.localise("music.options.loop.strings.enabled.title", locale)(),
		description: client.localise("music.options.loop.strings.enabled.description.song", locale)(),
	};

	client.reply(
		interaction,
		{
			embeds: [
				{
					title: `${constants.symbols.music.loopEnabled} ${strings.title}`,
					description: strings.description,
					color: constants.colors.blue,
				},
			],
		},
		{ visible: true },
	);
}

export default command;
