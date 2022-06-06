import { Interaction } from '../../../../../deps.ts';
import { Client } from '../../../../client.ts';
import { Availability } from '../../../../commands/availability.ts';
import { Command } from '../../../../commands/command.ts';
import { OptionType } from '../../../../commands/option.ts';
import { roles } from '../../module.ts';
import {
	RoleCategory,
	RoleCategoryType,
} from '../../data/structures/role-category.ts';
import { tryAssignRole } from '../../data/structures/role.ts';
import { browse } from './selection/browse.ts';
import configuration from '../../../../configuration.ts';

const command: Command = {
	name: 'profile',
	// TODO(vxern): Possible availability disparity when commands are merged, as the
	// availability of the first command overrides that of others' with the same name.
	availability: Availability.MEMBERS,
	options: [{
		name: 'roles',
		type: OptionType.SUB_COMMAND,
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
async function selectRoles(interaction: Interaction): Promise<void> {
	const navigation = {
		root: {
			type: RoleCategoryType.CATEGORY_GROUP,
			name: 'No Category Selected',
			description:
				'Please select a role category to obtain a list of available roles within it.',
			color: configuration.responses.colors.invisible,
			emoji: '💭',
			limit: -1,
			categories: Client.isManagedGuild(interaction.guild!)
				? Array<RoleCategory>().concat(...Object.values(roles.scopes))
				: roles.scopes.global,
		},
		indexes: [],
		index: 0,
	};

	const language = Client.getLanguage(interaction.guild!);

	const browsing = {
		interaction: interaction,
		navigation: navigation,
		language: language,
	};

	for await (const [role, category] of browse(browsing)) {
		tryAssignRole(interaction, language!, category, role);
	}
}

export default command;
