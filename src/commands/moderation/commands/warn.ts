import {
	ApplicationCommandFlags,
	banMember,
	Bot,
	getDmChannel,
	Interaction,
	InteractionResponseTypes,
	kickMember,
	sendInteractionResponse,
	sendMessage,
} from 'discordeno';
import { Commands, createLocalisations, localise } from 'logos/assets/localisations/mod.ts';
import { CommandBuilder } from 'logos/src/commands/mod.ts';
import { log } from 'logos/src/controllers/logging/mod.ts';
import { createWarning, getOrCreateUser, getWarnings } from 'logos/src/database/functions/mod.ts';
import {
	Client,
	configuration,
	defaultLanguage,
	guildAsAuthor,
	mention,
	MentionTypes,
	parseArguments,
	resolveInteractionToMember,
} from 'logos/src/mod.ts';
import { user } from 'logos/src/commands/mod.ts';
import { getRelevantWarnings, reason } from 'logos/src/commands/moderation/mod.ts';

const command: CommandBuilder = {
	...createLocalisations(Commands.warn),
	defaultMemberPermissions: ['MODERATE_MEMBERS'],
	handle: warnUser,
	options: [user, reason],
};

async function warnUser(
	[client, bot]: [Client, Bot],
	interaction: Interaction,
): Promise<void> {
	const [{ user, reason }] = parseArguments(interaction.data?.options, {});
	if (user === undefined) return;

	const member = resolveInteractionToMember(
		[client, bot],
		interaction,
		user,
	);
	if (!member) return;

	if (member.id === interaction.member?.id) {
		return void sendInteractionResponse(
			bot,
			interaction.id,
			interaction.token,
			{
				type: InteractionResponseTypes.ChannelMessageWithSource,
				data: {
					flags: ApplicationCommandFlags.Ephemeral,
					embeds: [{
						description: localise(
							Commands.warn.strings.cannotWarnSelf,
							interaction.locale,
						),
						color: configuration.interactions.responses.colors.yellow,
					}],
				},
			},
		);
	}

	const guild = client.cache.guilds.get(interaction.guildId!);
	if (!guild) return;

	const moderatorRoleId = guild.roles.find((role) => role.name === configuration.guilds.moderation.moderator)?.id;
	if (!moderatorRoleId) return;

	const isModerator = member.roles.includes(moderatorRoleId);
	if (isModerator) {
		return void sendInteractionResponse(
			bot,
			interaction.id,
			interaction.token,
			{
				type: InteractionResponseTypes.ChannelMessageWithSource,
				data: {
					flags: ApplicationCommandFlags.Ephemeral,
					embeds: [{
						description: localise(
							Commands.warn.strings.cannotWarnCertainUsers,
							interaction.locale,
						),
						color: configuration.interactions.responses.colors.yellow,
					}],
				},
			},
		);
	}

	const displayWarnError = (): void => {
		return void sendInteractionResponse(
			bot,
			interaction.id,
			interaction.token,
			{
				type: InteractionResponseTypes.ChannelMessageWithSource,
				data: {
					flags: ApplicationCommandFlags.Ephemeral,
					embeds: [{
						description: localise(
							Commands.warn.strings.failed,
							interaction.locale,
						),
						color: configuration.interactions.responses.colors.red,
					}],
				},
			},
		);
	};

	if (!user || !reason) return displayWarnError();

	const subject = await getOrCreateUser(client, 'id', member.id.toString());
	if (!subject) return displayWarnError();

	const author = await getOrCreateUser(client, 'id', interaction.user.id.toString());
	if (!author) return displayWarnError();

	const warnings = await getWarnings(client, subject.ref);
	if (!warnings) return displayWarnError();

	const document = await createWarning(
		client,
		{ author: author.ref, subject: subject.ref, reason },
	);
	if (!document) return displayWarnError();

	log([client, bot], guild, 'memberWarnAdd', member, document.data, interaction.user);

	const relevantWarnings = getRelevantWarnings(warnings);

	sendInteractionResponse(bot, interaction.id, interaction.token, {
		type: InteractionResponseTypes.ChannelMessageWithSource,
		data: {
			flags: ApplicationCommandFlags.Ephemeral,
			embeds: [{
				description: localise(Commands.warn.strings.warned, interaction.locale)(
					mention(member!.id, MentionTypes.User),
					relevantWarnings.length,
				),
				color: configuration.interactions.responses.colors.blue,
			}],
		},
	});

	const reachedKickStage = relevantWarnings.length >= configuration.guilds.moderation.warnings.maximum + 1;
	const reachedBanStage = relevantWarnings.length >= configuration.guilds.moderation.warnings.maximum + 2;

	const dmChannel = await getDmChannel(bot, member.id);
	if (dmChannel) {
		sendMessage(bot, dmChannel.id, {
			embeds: [
				{
					author: guildAsAuthor(bot, guild),
					...(
						reachedKickStage
							? (
								reachedBanStage
									? {
										description: localise(
											Commands.warn.strings.reachedBanStage,
											defaultLanguage,
										)(reason),
										color: configuration.interactions.responses.colors.darkRed,
									}
									: {
										description: localise(
											Commands.warn.strings.reachedKickStage,
											defaultLanguage,
										)(reason),
										color: configuration.interactions.responses.colors.red,
									}
							)
							: {
								description: localise(
									Commands.warn.strings.warnedDirect,
									defaultLanguage,
								)(
									reason,
									relevantWarnings.length,
									configuration.guilds.moderation.warnings.maximum,
								),
								color: configuration.interactions.responses.colors.yellow,
							}
					),
				},
			],
		});
	}

	if (reachedBanStage) {
		return banMember(
			bot,
			interaction.guildId!,
			member.id,
			{
				reason: `Banned due to having received too many warnings (${relevantWarnings.length}).`,
			},
		);
	}

	if (reachedKickStage) {
		return kickMember(
			bot,
			interaction.guildId!,
			member.id,
			`Kicked due to having received too many warnings (${relevantWarnings.length}).`,
		);
	}
}

export default command;
