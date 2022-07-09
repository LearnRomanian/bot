import { ApplicationCommandOptionType, Interaction } from '../../../../deps.ts';
import { Client } from '../../../client.ts';
import { Availability } from '../../../commands/structs/availability.ts';
import { Command } from '../../../commands/structs/command.ts';
import { roles } from '../module.ts';
import { tryAssignRole } from '../data/structures/role.ts';
import { browse, NavigationData } from './profile/browse.ts';
import configuration from '../../../configuration.ts';
import { getCategorySelections } from '../data/structures/role-category.ts';

const command: Command = {
	name: 'profile',
	// TODO(vxern): Possible availability disparity when commands are merged, as the
	// availability of the first command overrides that of others' with the same name.
	availability: Availability.MEMBERS,
	options: [{
		name: 'roles',
		type: ApplicationCommandOptionType.SUB_COMMAND,
		description: 'Opens the role selection menu.',
		handle: selectRoles,
	}],
};

/**
 * Displays a role selection menu to the user and allows them to assign or unassign roles
 * from within it.
 *
 * @param interaction - The interaction made by the user.
 */
async function selectRoles(
	client: Client,
	interaction: Interaction,
): Promise<void> {
	const language = client.getLanguage(interaction.guild!);

	const navigation: NavigationData = {
		root: {
			type: 'CATEGORY_GROUP',
			name: 'No Category Selected',
			description:
				'Please select a role category to obtain a list of available roles within it.',
			color: configuration.interactions.responses.colors.invisible,
			emoji: '💭',
			limit: -1,
			categories: Client.isManagedGuild(interaction.guild!)
				? [
					...roles.scopes.global,
					...getCategorySelections(roles.scopes.local, language).filter((
						[_category, shouldDisplay],
					) => shouldDisplay).map(([category, _shouldDisplay]) => category),
				]
				: roles.scopes.global,
		},
		indexes: [],
		index: 0,
	};

	const browsing = {
		client: client,
		interaction: interaction,
		navigation: navigation,
		language: language,
	};

	for await (const [role, category] of browse(browsing)) {
		tryAssignRole(interaction, language!, category, role);
	}
}

export default command;
