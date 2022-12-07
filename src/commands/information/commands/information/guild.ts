import {
	ApplicationCommandFlags,
	Bot,
	Channel,
	ChannelTypes,
	Guild,
	Interaction,
	InteractionResponseTypes,
	sendInteractionResponse,
} from 'discordeno';
import { Commands, localise } from 'logos/assets/localisations/mod.ts';
import { getProficiencyCategory } from 'logos/src/commands/social/module.ts';
import { Client } from 'logos/src/client.ts';
import { guildAsThumbnail, snowflakeToTimestamp } from 'logos/src/utils.ts';
import configuration from 'logos/configuration.ts';
import { displayTime, mention, MentionTypes } from 'logos/formatting.ts';
import { defaultLanguage } from 'logos/types.ts';

/** Displays information about the guild that this command was executed in. */
function handleDisplayGuildInformation(
	[client, bot]: [Client, Bot],
	interaction: Interaction,
): void {
	const guild = client.cache.guilds.get(interaction.guildId!);
	if (guild === undefined) return;

	const owner = client.cache.users.get(guild.ownerId);
	if (owner === undefined) return;

	const hasDistinctOwner = owner.username !== guild.name;

	const proficiencyRoleFrequencies = getProficiencyRoleFrequencies(client, guild);

	const descriptionString = localise(Commands.information.options.guild.strings.fields.description, interaction.locale);
	const membersString = localise(Commands.information.options.guild.strings.fields.members, interaction.locale);
	const createdString = localise(Commands.information.options.guild.strings.fields.created, interaction.locale);
	const channelsString = localise(Commands.information.options.guild.strings.fields.channels, interaction.locale);
	const ownerString = localise(Commands.information.options.guild.strings.fields.serverOwner, interaction.locale);
	const moderatorsString = localise(Commands.information.options.guild.strings.fields.moderators, interaction.locale);
	const proficiencyDistributionString = localise(
		Commands.information.options.guild.strings.fields.proficiencyDistribution,
		interaction.locale,
	);

	return void sendInteractionResponse(
		bot,
		interaction.id,
		interaction.token,
		{
			type: InteractionResponseTypes.ChannelMessageWithSource,
			data: {
				flags: ApplicationCommandFlags.Ephemeral,
				embeds: [{
					thumbnail: guildAsThumbnail(bot, guild),
					title: localise(Commands.information.options.guild.strings.informationAbout, interaction.locale)(guild.name),
					color: configuration.messages.colors.invisible,
					fields: [
						{
							name: `🖋️ ${descriptionString}`,
							value: guild.description ??
								localise(Commands.information.options.guild.strings.noDescription, interaction.locale),
							inline: true,
						},
						{
							name: `🧑 ${membersString}`,
							value: guild.memberCount.toString(),
							inline: true,
						},
						{
							name: `⏱️ ${createdString}`,
							value: displayTime(snowflakeToTimestamp(guild.id)),
							inline: true,
						},
						{
							name: `🗯️ ${channelsString}`,
							value: displayInformationAboutChannels(guild, interaction.locale),
							inline: true,
						},
						hasDistinctOwner
							? {
								name: `👑 ${ownerString}`,
								value: mention(owner.id, MentionTypes.User),
								inline: true,
							}
							: {
								name: `⚖️ ${moderatorsString}`,
								value: localise(Commands.information.options.guild.strings.overseenByModerators, interaction.locale)(
									configuration.permissions.moderatorRoleName.toLowerCase(),
								),
								inline: false,
							},
						{
							name: `🎓 ${proficiencyDistributionString}`,
							value: displayProficiencyRoleDistribution(proficiencyRoleFrequencies, interaction.locale),
							inline: false,
						},
					],
				}],
			},
		},
	);
}

function displayInformationAboutChannels(guild: Guild, locale: string | undefined): string {
	const channels = guild.channels.array();

	const textChannelsCount = getChannelCountByType(channels, ChannelTypes.GuildText);
	const voiceChannelsCount = getChannelCountByType(channels, ChannelTypes.GuildVoice);

	const textChannelsString = localise(Commands.information.options.guild.strings.channelTypes.text, locale);
	const voiceChannelsString = localise(Commands.information.options.guild.strings.channelTypes.voice, locale);

	return `📜 ${textChannelsCount} ${textChannelsString} | 🔊 ${voiceChannelsCount} ${voiceChannelsString}`;
}

function getChannelCountByType(channels: Channel[], type: ChannelTypes): number {
	return channels.filter((channel) => channel.type === type).length;
}

/**
 * Taking a guild object, gets the distribution of proficiency roles of its members.
 *
 * @param client - The client instance to use.
 * @param guild - The guild of which the role frequencies to get.
 * @returns A map where the keys represent the proficiency role ID, and the values
 * represent the frequency of members that have that role.
 */
function getProficiencyRoleFrequencies(
	client: Client,
	guild: Guild,
): Map<bigint, number> {
	const proficiencyCategory = getProficiencyCategory();
	const proficiencies = proficiencyCategory.collection.list;
	const proficiencyRoleNames = proficiencies.map((proficiency) => proficiency.name[defaultLanguage]);
	const proficiencyRoles = guild.roles.array()
		.filter((role) => proficiencyRoleNames.includes(role.name))
		.toSorted((a, b) => a.position - b.position);
	const proficiencyRoleIds = proficiencyRoles.map((role) => role.id);

	const membersIndiscriminate = Array.from(client.cache.members.values());
	const members = membersIndiscriminate.filter((member) =>
		!client.cache.users.get(member.id)?.toggles.bot &&
		member.guildId === guild.id
	);

	const roleFrequencies = new Map<bigint, number>();
	roleFrequencies.set(-1n, 0);
	for (const proficiencyRoleId of proficiencyRoleIds) {
		roleFrequencies.set(proficiencyRoleId, 0);
	}

	for (const member of members) {
		const relevantRoleIds = member.roles.filter((roleId) => proficiencyRoleIds.includes(roleId));

		if (relevantRoleIds.length === 0) {
			relevantRoleIds.push(-1n);
		}

		for (const roleId of relevantRoleIds) {
			roleFrequencies.set(roleId, roleFrequencies.get(roleId)! + 1);
		}
	}

	return roleFrequencies;
}

/**
 * @param proficiencyRoleFrequencies - The frequencies of proficiency roles found
 * in members of a certain guild.
 * @returns A string representation of the proficiency distribution.
 */
function displayProficiencyRoleDistribution(
	proficiencyRoleFrequencies: Map<bigint, number>,
	locale: string | undefined,
): string {
	const total = Array.from(proficiencyRoleFrequencies.values()).reduce((a, b) => a + b);

	const strings: string[] = [];
	for (const [roleId, frequency] of Array.from(proficiencyRoleFrequencies.entries())) {
		const percentageComposition = getPercentageComposition(frequency, total);
		const roleMention = roleId === -1n
			? localise(Commands.information.options.guild.strings.withoutProficiencyRole, locale)
			: mention(roleId, MentionTypes.Role);

		strings.unshift(`${frequency} (${percentageComposition}%) ${roleMention}`);
	}

	return strings.join('\n');
}

/**
 * Taking a number and a total, returns the formatted percentage.
 *
 * @param number - The proportion in relation to the total.
 * @param total - The total number of elements.
 * @returns A string representation of the percentage that the number takes up.
 */
function getPercentageComposition(number: number, total: number): string {
	return ((number / total) * 100).toPrecision(3);
}

export { handleDisplayGuildInformation };
