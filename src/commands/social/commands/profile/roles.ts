import {
	addRole,
	ApplicationCommandFlags,
	ApplicationCommandOptionTypes,
	editInteractionResponse,
	Interaction,
	InteractionResponse,
	InteractionResponseTypes,
	InteractionTypes,
	MessageComponentTypes,
	removeRole,
	Role as DiscordRole,
	SelectOption,
	sendInteractionResponse,
	snowflakeToBigint,
} from '../../../../../deps.ts';
import { Client, getLanguage } from '../../../../client.ts';
import { Language } from '../../../../types.ts';
import { createInteractionCollector } from '../../../../utils.ts';
import configuration from '../../../../configuration.ts';
import {
	createSelectOptionsFromCategories,
	getRelevantCategories,
	RoleCategory,
	RoleCategoryTypes,
} from '../../data/structures/role-category.ts';
import {
	createSelectOptionsFromCollection,
	resolveRoles,
} from '../../data/structures/role-collection.ts';
import { OptionBuilder } from '../../../command.ts';
import { Role } from '../../data/structures/role.ts';
import roles from '../../data/roles.ts';

const command: OptionBuilder = {
	name: 'roles',
	nameLocalizations: {
		pl: 'role',
		ro: 'roluri',
	},
	description: 'Opens the role selection menu.',
	descriptionLocalizations: {
		pl: 'Otwiera menu wybierania ról.',
		ro: 'Deschide meniul selectării rolurilor.',
	},
	type: ApplicationCommandOptionTypes.SubCommand,
	handle: selectRoles,
};

/**
 * Displays a role selection menu to the user and allows them to assign or unassign roles
 * from within it.
 */
function selectRoles(
	client: Client,
	interaction: Interaction,
): void {
	const language = getLanguage(client, interaction.guildId!);

	const rootCategories = getRelevantCategories(roles, language);

	return createRoleSelectionMenu(
		client,
		interaction,
		{
			navigationData: {
				root: {
					type: RoleCategoryTypes.CategoryGroup,
					name: 'No Category Selected',
					description:
						'Please select a role category to obtain a list of available roles within it.',
					color: configuration.interactions.responses.colors.invisible,
					emoji: '💭',
					categories: rootCategories,
				},
				indexesAccessed: [],
			},
			language: language,
		},
	);
}

/**
 * Represents a template for data used in browsing through the selection menu and
 * managing the interaction that requested it.
 */
interface BrowsingData {
	/**
	 * The navigation data associated with this menu required for the
	 * ability to browse through it.
	 */
	navigationData: NavigationData;

	/** The language of the guild where the interaction was made. */
	language?: Language;
}

/**
 * Represents a template for data used in navigation between sections of the
 * role selection menu.
 */
interface NavigationData {
	/**
	 * The root category, which is not part of another category's list of
	 * categories.
	 */
	root: RoleCategory;

	/**
	 * A stack containing the indexes accessed in succession to arrive at the
	 * current position in the role selection menu.
	 */
	indexesAccessed: number[];
}

/**
 * Traverses the role category tree and returns the role category the user is
 * viewing currently.
 *
 * @param data - Navigation data for the selection menu.
 * @returns The category the user is now viewing.
 */
function traverseRoleSelectionTree(data: NavigationData): RoleCategory {
	let category = data.root;
	for (const index of data.indexesAccessed) {
		category =
			(<RoleCategory & { type: RoleCategoryTypes.CategoryGroup }> category)
				.categories![index]!;
	}
	return category;
}

/**
 * Creates a browsing menu for selecting roles.
 */
function createRoleSelectionMenu(
	client: Client,
	interaction: Interaction,
	data: BrowsingData,
): void {
	const guild = client.guilds.get(interaction.guildId!);
	if (!guild) return;

	const emojiIdsByName = new Map(
		guild.emojis.map((emoji) => [emoji.name!, emoji.id!]),
	);

	const member = client.members.get(
		snowflakeToBigint(`${interaction.user.id}${guild.id}`),
	);
	if (!member) return;

	const memberRoleIds = [...member.roles];
	const rolesByName = new Map(
		guild.roles.array().map((role) => [role.name, role]),
	);

	let category: RoleCategory;
	let menuRoles: Role[];
	let menuRolesResolved: DiscordRole[];
	let memberRolesIncludedInMenu: bigint[];

	const traverseRoleTreeAndDisplay = (
		interaction: Interaction,
		editResponse = true,
	): void => {
		category = traverseRoleSelectionTree(data.navigationData);

		if (category.type === RoleCategoryTypes.Category) {
			menuRoles = resolveRoles(category.collection, data.language);
			menuRolesResolved = menuRoles.map((role) => rolesByName.get(role.name)!);
			memberRolesIncludedInMenu = memberRoleIds.filter((roleId) =>
				menuRolesResolved.some((role) => role.id === roleId)
			);
		}

		let selectOptions: SelectOption[];
		if (category.type === RoleCategoryTypes.CategoryGroup) {
			selectOptions = createSelectOptionsFromCategories(
				category.categories!,
				data.language,
			);
		} else {
			selectOptions = createSelectOptionsFromCollection(
				menuRoles,
				menuRolesResolved,
				memberRolesIncludedInMenu,
				emojiIdsByName,
			);
		}

		const menu = displaySelectMenu(selectOptions, data, customId, category);

		if (editResponse) {
			return void editInteractionResponse(
				client.bot,
				interaction.token,
				menu.data!,
			);
		}

		return void sendInteractionResponse(
			client.bot,
			interaction.id,
			interaction.token,
			menu,
		);
	};

	const customId = createInteractionCollector(
		client,
		{
			type: InteractionTypes.MessageComponent,
			userId: interaction.user.id,
			onCollect: (bot, selection) => {
				sendInteractionResponse(bot, selection.id, selection.token, {
					type: InteractionResponseTypes.DeferredUpdateMessage,
				});

				const indexString = selection.data?.values?.at(0);
				if (!indexString) return;

				const index = Number(indexString);
				if (isNaN(index)) return;

				if (index === -1) {
					data.navigationData.indexesAccessed.pop();
					return traverseRoleTreeAndDisplay(selection);
				}

				if (category.type === RoleCategoryTypes.CategoryGroup) {
					data.navigationData.indexesAccessed.push(index);
					return traverseRoleTreeAndDisplay(selection);
				}

				const role = menuRolesResolved.at(index)!;

				const alreadyHasRole = memberRolesIncludedInMenu.includes(role.id);

				if (alreadyHasRole) {
					removeRole(
						bot,
						guild.id,
						member.id,
						role.id,
						'User-requested role removal.',
					);
					memberRoleIds.splice(
						memberRoleIds.findIndex((roleId) => roleId === role.id)!,
						1,
					);
					memberRolesIncludedInMenu.splice(
						memberRolesIncludedInMenu.findIndex((roleId) =>
							roleId === role.id
						)!,
						1,
					);
				} else {
					if (category.restrictToOneRole) {
						for (const memberRoleId of memberRolesIncludedInMenu) {
							removeRole(bot, guild.id, member.id, memberRoleId);
							memberRoleIds.splice(
								memberRoleIds.findIndex((roleId) => roleId === memberRoleId)!,
								1,
							);
						}
						memberRolesIncludedInMenu = [];
					} else if (
						category.limit &&
						memberRolesIncludedInMenu.length >= category.limit
					) {
						sendInteractionResponse(
							client.bot,
							interaction.id,
							interaction.token,
							{
								type: InteractionResponseTypes.ChannelMessageWithSource,
								data: {
									flags: ApplicationCommandFlags.Ephemeral,
									embeds: [{
										title:
											`Reached role limit in the '${category.name}' category.`,
										description:
											`You have reached the limit of roles you can assign from within the '${category.name}' category.

To choose a new role, unassign one of your existing roles.`,
									}],
								},
							},
						);

						return traverseRoleTreeAndDisplay(interaction, true);
					}

					addRole(
						bot,
						guild.id,
						member.id,
						role.id,
						'User-requested role addition.',
					);
					memberRoleIds.push(role.id);
					memberRolesIncludedInMenu.push(role.id);
				}

				traverseRoleTreeAndDisplay(interaction, true);
			},
		},
	);

	return traverseRoleTreeAndDisplay(interaction, false);
}

/**
 * Creates a selection menu and returns its object.
 *
 * @param selectOptions - The options to display in the selection menu.
 * @param data - The data used for displaying the selection menu.
 * @param customId - The ID of the selection menu.
 * @param category - The role category shown.
 * @returns A promise resolving to an interaction response.
 */
function displaySelectMenu(
	selectOptions: SelectOption[],
	data: BrowsingData,
	customId: string,
	category: RoleCategory,
): InteractionResponse {
	const isInRootCategory = data.navigationData.indexesAccessed.length === 0;

	if (!isInRootCategory) {
		selectOptions.push({
			label: 'Back',
			value: `${-1}`,
		});
	}

	return {
		type: InteractionResponseTypes.ChannelMessageWithSource,
		data: {
			flags: ApplicationCommandFlags.Ephemeral,
			embeds: [{
				title: `${category.emoji}  ${category.name}`,
				description: category.description,
				color: category.color,
			}],
			components: [{
				type: MessageComponentTypes.ActionRow,
				components: [{
					type: MessageComponentTypes.SelectMenu,
					customId: customId,
					options: selectOptions,
					placeholder: category.type === RoleCategoryTypes.CategoryGroup
						? 'Choose a role category.'
						: 'Choose a role.',
				}],
			}],
		},
	};
}

export default command;
