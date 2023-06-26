import { ApplicationCommandOptionTypes, Bot, Interaction } from 'discordeno';
import { OptionTemplate } from 'logos/src/lib/commands/command.ts';
import { collection } from 'logos/src/lib/commands/parameters.ts';
import {
	getVoiceState,
	isCollection,
	isOccupied,
	replay,
	verifyCanManagePlayback,
} from 'logos/src/lib/controllers/music.ts';
import { Client, localise } from 'logos/src/lib/client.ts';
import { parseArguments, reply } from 'logos/src/lib/interactions.ts';
import constants from 'logos/src/constants.ts';
import { defaultLocale } from 'logos/src/types.ts';

const command: OptionTemplate = {
	name: 'replay',
	type: ApplicationCommandOptionTypes.SubCommand,
	handle: handleReplayAction,
	options: [collection],
};

function handleReplayAction([client, bot]: [Client, Bot], interaction: Interaction): void {
	const [{ collection }] = parseArguments(interaction.data?.options, { collection: 'boolean' });

	const controller = client.features.music.controllers.get(interaction.guildId!);
	if (controller === undefined) return;

	const isVoiceStateVerified = verifyCanManagePlayback(
		[client, bot],
		interaction,
		controller,
		getVoiceState(client, interaction.guildId!, interaction.user.id),
	);
	if (!isVoiceStateVerified) return;

	const currentListing = controller.currentListing;

	if (!collection) {
		if (!isOccupied(controller.player) || currentListing === undefined) {
			const strings = {
				title: localise(client, 'music.options.replay.strings.noSong.title', interaction.locale)(),
				description: localise(client, 'music.options.replay.strings.noSong.description', interaction.locale)(),
			};

			return void reply([client, bot], interaction, {
				embeds: [{
					title: strings.title,
					description: strings.description,
					color: constants.colors.dullYellow,
				}],
			});
		}
	} else {
		if (!isOccupied(controller.player) || currentListing === undefined) {
			const strings = {
				title: localise(
					client,
					'music.options.replay.strings.noSongCollection.title',
					interaction.locale,
				)(),
				description: {
					noSongCollection: localise(
						client,
						'music.options.replay.strings.noSongCollection.description.noSongCollection',
						interaction.locale,
					)(),
				},
			};

			return void reply([client, bot], interaction, {
				embeds: [{
					title: strings.title,
					description: strings.description.noSongCollection,
					color: constants.colors.dullYellow,
				}],
			});
		} else if (!isCollection(currentListing.content)) {
			const strings = {
				title: localise(
					client,
					'music.options.replay.strings.noSongCollection.title',
					interaction.locale,
				)(),
				description: {
					noSongCollection: localise(
						client,
						'music.options.replay.strings.noSongCollection.description.noSongCollection',
						interaction.locale,
					)(),
					trySongInstead: localise(
						client,
						'music.options.replay.strings.noSongCollection.description.trySongInstead',
						interaction.locale,
					)(),
				},
			};

			return void reply([client, bot], interaction, {
				embeds: [{
					title: strings.title,
					description: `${strings.description.noSongCollection}\n\n${strings.description.trySongInstead}`,
					color: constants.colors.dullYellow,
				}],
			});
		}
	}

	replay([client, bot], interaction, controller, collection ?? false);

	const strings = {
		title: localise(client, 'music.options.replay.strings.replaying.title', defaultLocale)(),
		description: localise(client, 'music.options.replay.strings.replaying.description', defaultLocale)(),
	};

	return void reply([client, bot], interaction, {
		embeds: [{
			title: `${constants.symbols.music.replaying} ${strings.title}`,
			description: strings.description,
			color: constants.colors.blue,
		}],
	}, { visible: true });
}

export default command;
