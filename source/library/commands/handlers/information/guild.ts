import { mention, timestamp } from "rost:constants/formatting";
import type { Client } from "rost/client";

/** Displays information about the guild that this command was executed in. */
async function handleDisplayGuildInformation(client: Client, interaction: Rost.Interaction): Promise<void> {
	const guild = client.entities.guilds.get(interaction.guildId);
	if (guild === undefined) {
		return;
	}

	const owner = client.entities.users.get(guild.ownerId);
	if (owner === undefined) {
		return;
	}

	const strings = constants.contexts.guildInformation({ localise: client.localise, locale: interaction.locale });

	client
		.notice(
			interaction,
			{
				embeds: [
					{
						author: {
							iconUrl: Discord.guildIconUrl(guild.id, guild.icon, { size: 4096, format: "png" }),
							name: strings.title({ server_name: guild.name }),
						},
						fields: [
							{
								name: `${constants.emojis.commands.information.guild.description} ${strings.description.description.title}`,
								value: guild.description ?? strings.description.description.noDescription,
								inline: true,
							},
							{
								name: `${constants.emojis.commands.information.guild.members} ${strings.description.members}`,
								value: guild.memberCount.toString(),
								inline: true,
							},
							{
								name: `${constants.emojis.commands.information.guild.created} ${strings.description.created}`,
								value: timestamp(Discord.snowflakeToTimestamp(guild.id), { format: "relative" }),
								inline: true,
							},
							{
								name: `${constants.emojis.commands.information.guild.channels.channels} ${strings.description.channels}`,
								value: getChannelInformationSection(client, interaction, guild),
								inline: true,
							},
							{
								name: `${constants.emojis.commands.information.guild.moderators} ${strings.description.moderators.title}`,
								value: strings.description.moderators.overseenByModerators,
								inline: false,
							},
							{
								name: `${constants.emojis.commands.information.guild.proficiencyDistribution} ${strings.description.distribution}`,
								value: formatDistribution(
									client,
									interaction,
									getProficiencyRoleDistribution(client, guild),
								),
								inline: false,
							},
						],
					},
				],
				components: interaction.parameters.show
					? []
					: [
							{
								type: Discord.MessageComponentTypes.ActionRow,
								components: [
									client.services.global("interactionRepetition").getShowButton(interaction),
								],
							},
						],
			},
			{ visible: interaction.parameters.show },
		)
		.ignore();
}

function getChannelInformationSection(client: Client, interaction: Rost.Interaction, guild: Rost.Guild): string {
	function getChannelCountByType(channels: Rost.Channel[], type: Discord.ChannelTypes): number {
		return channels.filter((channel) => channel.type === type).length;
	}

	const channels = guild.channels.array();
	const textChannelsCount = getChannelCountByType(channels, Discord.ChannelTypes.GuildText);
	const voiceChannelsCount = getChannelCountByType(channels, Discord.ChannelTypes.GuildVoice);

	const strings = constants.contexts.channelTypes({ localise: client.localise, locale: interaction.locale });

	return `${constants.emojis.commands.information.guild.channels.text} ${strings.text} – ${textChannelsCount}\n${constants.emojis.commands.information.guild.channels.voice} ${strings.voice} – ${voiceChannelsCount}`;
}

type ProficiencyRoleDistribution = [withRole: [roleId: bigint, frequency: number][], withoutRole: number];

/** Gets the distribution of proficiency roles of a guild's members. */
function getProficiencyRoleDistribution(client: Client, guild: Rost.Guild): ProficiencyRoleDistribution {
	const guildIdString = guild.id.toString();

	const proficiencyRoleIdsUnsorted = Object.values(
		constants.roles.language.categories.proficiency.collection.list,
	).map((role) => {
		const snowflake = (role.snowflakes as Record<string, string>)[guildIdString];
		if (snowflake === undefined) {
			throw new Error(`Could not get the snowflake of ${client.diagnostics.role(role.id)}.`);
		}

		return BigInt(snowflake);
	});
	const proficiencyRoleIds = proficiencyRoleIdsUnsorted
		.map((roleId) => {
			const role = guild.roles.get(roleId);
			if (role === undefined) {
				throw new Error(`The ${client.diagnostics.role(roleId)} no longer exists.`);
			}

			return role;
		})
		.sort((a, b) => a.position - b.position)
		.map((role) => role.id);

	const members = guild.members.array().filter((member) => !client.entities.users.get(member.id)?.bot);

	let withoutProficiencyRole = 0;
	const roleFrequencies: Record<`${bigint}`, number> = Object.fromEntries(
		proficiencyRoleIds.map((roleId) => [`${roleId}`, 0]),
	);

	for (const member of members) {
		const roleId = member.roles.filter((roleId) => proficiencyRoleIds.includes(roleId)).at(0);

		if (roleId !== undefined) {
			roleFrequencies[`${roleId}`]! += 1;
		} else {
			withoutProficiencyRole += 1;
		}
	}

	return [
		Object.entries(roleFrequencies).map(([roleId, frequency]) => [BigInt(roleId), frequency]),
		withoutProficiencyRole,
	];
}

function getPercentageComposition(number: number, total: number): string {
	return ((number / total) * 100).toPrecision(3);
}

function formatFrequency(frequency: number, percentage: string, roleMention: string): string {
	return `${frequency} (${percentage}%) ${roleMention}`;
}

function formatDistribution(
	client: Client,
	interaction: Rost.Interaction,
	distribution: ProficiencyRoleDistribution,
): string {
	const [roleFrequencies, withoutRole] = distribution;

	const total = roleFrequencies.map(([_, value]) => value).reduce((a, b) => a + b, withoutRole);

	const strings = constants.contexts.withoutProficiency({ localise: client.localise, locale: interaction.locale });
	const stringParts: string[] = [
		formatFrequency(withoutRole, getPercentageComposition(withoutRole, total), strings.withoutProficiency),
	];
	for (const [roleId, frequency] of roleFrequencies) {
		const percentage = getPercentageComposition(frequency, total);
		const roleMention = mention(roleId, { type: "role" });

		stringParts.unshift(`${frequency} (${percentage}%) ${roleMention}`);
	}

	return stringParts.join("\n");
}

export { handleDisplayGuildInformation };
