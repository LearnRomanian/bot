import { Bot, getAvatarURL, getUser, Interaction } from 'discordeno';
import { Client, localise } from 'logos/src/client.ts';
import { reply } from 'logos/src/interactions.ts';
import constants from 'logos/constants.ts';
import { mention, MentionTypes } from 'logos/formatting.ts';

async function handleDisplayBotInformation([client, bot]: [Client, Bot], interaction: Interaction): Promise<void> {
	const botUser = client.cache.users.get(bot.id) ?? await getUser(bot, bot.id);

	const strings = {
		information: {
			whoAmI: {
				title: localise(client, 'information.options.bot.strings.whoAmI.title', interaction.locale)(),
				description: localise(client, 'information.options.bot.strings.whoAmI.description', interaction.locale)(
					{ 'username': botUser.username },
				),
			},
			howWasIMade: {
				title: localise(client, 'information.options.bot.strings.howWasIMade.title', interaction.locale)(),
				description: localise(client, 'information.options.bot.strings.howWasIMade.description', interaction.locale)(
					{
						'language_link': constants.links.typescriptWebsite,
						'runtime_link': constants.links.denoWebsite,
						'api_link': constants.links.discordApiWebsite,
						'library_link': constants.links.discordenoRepository,
					},
				),
			},
			howToAddToServer: {
				title: localise(client, 'information.options.bot.strings.howToAddToServer.title', interaction.locale)(),
				description: localise(
					client,
					'information.options.bot.strings.howToAddToServer.description',
					interaction.locale,
				)(
					{
						'learn_armenian_link': constants.links.learnArmenianListingWebsite,
						'learn_romanian_link': constants.links.learnRomanianListingWebsite,
					},
				),
			},
			amIOpenSource: {
				title: localise(client, 'information.options.bot.strings.amIOpenSource.title', interaction.locale)(),
				description: localise(
					client,
					'information.options.bot.strings.amIOpenSource.description',
					interaction.locale,
				)(),
			},
		},
		translators: {
			title: localise(client, 'information.options.bot.strings.translators.title', interaction.locale)(),
		},
	};

	return void reply([client, bot], interaction, {
		embeds: [{
			title: botUser.username,
			thumbnail: {
				url: getAvatarURL(bot, bot.id, botUser.discriminator, {
					avatar: botUser.avatar,
					size: 4096,
					format: 'png',
				}),
			},
			color: constants.colors.invisible,
			fields: [{
				name: strings.information.whoAmI.title,
				value: strings.information.whoAmI.description,
			}, {
				name: strings.information.howWasIMade.title,
				value: strings.information.howWasIMade.description,
			}, {
				name: strings.information.howToAddToServer.title,
				value: strings.information.howToAddToServer.description,
			}, {
				name: strings.information.amIOpenSource.title,
				value: strings.information.amIOpenSource.description,
			}],
		}, {
			title: strings.translators.title,
			color: constants.colors.invisible,
			fields: Object.entries(constants.contributions.translation).map(([language, data]) => {
				const contributorsFormatted = data.contributors.map((contributor) => {
					const userMention = mention(contributor.id, MentionTypes.User);

					if ('links' in contributor) {
						const linksFormatted = Object.entries(contributor.links)
							.map(([platform, link]) => `[${platform}](${link})`).join(', ');

						return `${userMention} (${linksFormatted})`;
					}

					return userMention;
				}).join('\n');

				return {
					name: `${language} ${data.flag}`,
					value: contributorsFormatted,
					inline: true,
				};
			}),
		}],
	});
}

export { handleDisplayBotInformation };
