import { getRoleCategories } from "rost:constants/roles";
import type { Client } from "rost/client";
import { RoleSelectionComponent } from "rost/commands/components/role-selection";

/**
 * Displays a role selection menu to the user and allows them to assign or unassign roles
 * from within it.
 */
async function handleOpenRoleSelectionMenu(client: Client, interaction: Rost.Interaction): Promise<void> {
	const categories = getRoleCategories(constants.roles, interaction.guildId);
	const roleSelection = new RoleSelectionComponent(client, { interaction, categories });

	await roleSelection.display();
}

export { handleOpenRoleSelectionMenu };
