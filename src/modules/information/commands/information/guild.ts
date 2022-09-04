import {
	colors,
	fetchMembers,
	Guild,
	guildIconURL,
	Interaction,
	InteractionResponseTypes,
	sendInteractionResponse,
} from '../../../../../deps.ts';
import { Client } from '../../../../client.ts';
import configuration from '../../../../configuration.ts';
import { capitalise, displayTime, mention } from '../../../../formatting.ts';
import { snowflakeToTimestamp } from "../../../../utils.ts";
import { getProficiencyCategory } from '../../../roles/module.ts';

/** Displays information about the guild that this command was executed in. */
async function displayGuildInformation(
	client: Client,
	interaction: Interaction,
): Promise<unknown> {
	const guild = client.guilds.get(interaction.guildId!);
	if (!guild) return;

	const owner = client.users.get(guild.ownerId);
	if (!owner) {
		return console.error(
			`Failed to fetch information about the owner of guild ${
				colors.bold(guild.name!)
			}.`,
		);
	}

	const hasDistinctOwner = owner && owner.username !== guild.name!;

	const proficiencyRoleFrequencies = await getProficiencyRoleFrequencies(
		client,
		guild,
	);

	return sendInteractionResponse(
		client.bot,
		interaction.id,
		interaction.token,
		{
			type: InteractionResponseTypes.ChannelMessageWithSource,
			data: {
				embeds: [{
					title: `Information about **${guild.name!}**`,
					thumbnail: (() => {
						const iconURL = guildIconURL(client.bot, guild.id, guild.icon);
						if (!iconURL) return undefined;

						return {
							url: iconURL,
						};
					})(),
					color: configuration.interactions.responses.colors.invisible,
					fields: [
						{
							name: '🖋️ Description',
							value: guild.description ?? 'No description provided.',
							inline: true,
						},
						{
							name: '🧑 Members',
							value: guild.memberCount!.toString(),
							inline: true,
						},
						{
							name: '⏱️ Created',
							value: displayTime(snowflakeToTimestamp(guild.id)),
							inline: true,
						},
						{
							name: '🎓 Proficiency Distribution',
							value: displayProficiencyRoleDistribution(
								proficiencyRoleFrequencies,
							),
							inline: false,
						},
						hasDistinctOwner
							? {
								name: '👑 Owner',
								value: mention(owner.id, 'USER'),
								inline: true,
							}
							: ((enforcerRoleName) => ({
								name: `⚖️ ${capitalise(enforcerRoleName)}s`,
								value:
									`This server is overseen by a collective of ${enforcerRoleName}s, rather than a single owner.`,
								inline: true,
							}))(configuration.guilds.moderation.enforcer.toLowerCase()),
					],
				}],
			},
		},
	);
}

/**
 * Taking a guild object, gets a distribution of the proficiencies of its members.
 *
 * @param client - The client instance to use.
 * @param guild - The guild of which the role frequencies to get.
 * @returns A map where the keys represent the proficiency role ID, and the values
 * represent the frequency of members that have that role.
 */
async function getProficiencyRoleFrequencies(
	client: Client,
	guild: Guild,
): Promise<Map<bigint, number>> {
	await fetchMembers(client.bot, guild.id, { limit: 0, query: '' });

	const proficiencies = getProficiencyCategory().collection!.list!;
	const proficiencyNames = proficiencies.map((proficiency) => proficiency.name);
	const proficiencyRoleIds = guild.roles.array().filter((role) =>
		proficiencyNames.includes(role.name)
	).map((role) => role.id);

	const membersIndiscriminate = Array.from(client.members.values());
	const members = membersIndiscriminate.filter((member) =>
		!client.users.get(member.id)?.toggles.bot && member.guildId === guild.id
	);

	const roleFrequencies = new Map<bigint, number>();
	roleFrequencies.set(-1n, 0);
	for (const proficiencyRoleId of proficiencyRoleIds) {
		roleFrequencies.set(proficiencyRoleId, 0);
	}

	for (const member of members) {
		const relevantRoleIds = member.roles.filter((roleId) =>
			proficiencyRoleIds.includes(roleId)
		);

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
): string {
	const total = Array.from(proficiencyRoleFrequencies.values()).reduce((a, b) =>
		a + b
	);

	const strings: string[] = [];
	for (
		const [roleId, frequency] of Array.from(
			proficiencyRoleFrequencies.entries(),
		)
	) {
		const percentageComposition = getPercentageComposition(frequency, total);
		const roleMention = roleId === -1n
			? 'without a proficiency role.'
			: mention(roleId, 'ROLE');

		strings.push(`${frequency} (${percentageComposition}%) ${roleMention}`);
	}

	strings.reverse();

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

export { displayGuildInformation };
