import { trim } from "rost:constants/formatting";
import {
	type Role,
	type RoleCategory,
	type RoleCategoryGroup,
	type RoleCustom,
	type RoleImplicit,
	getRoleCategories,
	getRoles,
	isCustom,
	isGroup,
	isSingle,
} from "rost:constants/roles";
import { isDefined } from "rost:core/utilities";
import type { Client } from "rost/client";
import { InteractionCollector } from "rost/collectors";

class RoleSelectionComponent {
	readonly #client: Client;
	readonly #selections: InteractionCollector;
	readonly #root: RoleCategoryGroup;
	readonly #history: string[];
	readonly #interaction: Rost.Interaction;
	roleData!: {
		emojiIdsByName: Map<string, bigint>;
		rolesById: Map<bigint, Rost.Role>;
		memberRoleIds: bigint[];
	};
	viewData!: {
		category: RoleCategory;
		menuRoles: Record<string, Role>;
		menuRolesResolved: Record<string, Rost.Role | undefined>;
		memberRolesIncludedInMenu: bigint[];
	};

	constructor(
		client: Client,
		{ interaction, categories }: { interaction: Rost.Interaction; categories: Record<string, RoleCategory> },
	) {
		this.#client = client;
		this.#selections = new InteractionCollector(this.#client, { only: [interaction.user.id] });
		this.#root = {
			type: "group",
			id: "roles.noCategory",
			color: constants.colours.invisible,
			emoji: constants.emojis.roles.noCategory,
			categories,
		};
		this.#history = [];
		this.#interaction = interaction;
	}

	#setup(): void {
		const guild = this.#client.entities.guilds.get(this.#interaction.guildId);
		if (guild === undefined) {
			return;
		}

		const emojiIdsByName = new Map<string, bigint>();
		for (const emoji of guild.emojis.values()) {
			const { name, id } = emoji;
			if (name === undefined || id === undefined) {
				continue;
			}

			emojiIdsByName.set(name, id);
		}

		const member = this.#client.entities.members.get(guild.id)?.get(this.#interaction.user.id);
		if (member === undefined) {
			return;
		}

		const rolesById = new Map(guild.roles.array().map((role) => [role.id, role]));

		this.roleData = { emojiIdsByName, rolesById, memberRoleIds: [...member.roles] };
	}

	async display(): Promise<void> {
		this.#setup();

		this.#selections.onInteraction(this.#handleSelection.bind(this));

		await this.#client.registerInteractionCollector(this.#selections);

		await this.#traverseRoleTreeAndDisplay(this.#interaction, { editResponse: false });
	}

	async #handleSelection(selection: Rost.Interaction): Promise<void> {
		this.#client.acknowledge(selection).ignore();

		const identifier = selection.data?.values?.at(0);
		if (identifier === undefined) {
			return;
		}

		if (identifier === constants.special.roles.back) {
			this.#history.pop();
			await this.#traverseRoleTreeAndDisplay(selection, { editResponse: true });
			return;
		}

		const viewData = this.viewData;
		if (viewData === undefined) {
			return;
		}

		if (isGroup(viewData.category)) {
			this.#history.push(identifier);
			await this.#traverseRoleTreeAndDisplay(selection, { editResponse: true });
			return;
		}

		const role = viewData.menuRolesResolved[identifier];
		if (role === undefined) {
			return;
		}

		const alreadyHasRole = viewData.memberRolesIncludedInMenu.includes(role.id);

		if (alreadyHasRole) {
			if (
				viewData.category.minimum !== undefined &&
				viewData.memberRolesIncludedInMenu.length <= viewData.category.minimum
			) {
				await this.#traverseRoleTreeAndDisplay(selection, {
					editResponse: true,
				});
				return;
			}

			this.#client.bot.helpers
				.removeRole(selection.guildId, selection.user.id, role.id, "User-requested role removal.")
				.catch((error) =>
					this.#client.log.warn(
						error,
						`Failed to remove ${this.#client.diagnostics.role(role)} from ${this.#client.diagnostics.user(
							selection.user,
						)} on ${this.#client.diagnostics.guild(selection.guildId)}.`,
					),
				);

			const roleIndex = this.roleData.memberRoleIds.findIndex((roleId) => roleId === role.id);
			const roleInMenuIndex = viewData.memberRolesIncludedInMenu.findIndex((roleId) => roleId === role.id);
			if (roleIndex !== undefined && roleInMenuIndex !== undefined) {
				this.roleData.memberRoleIds.splice(roleIndex, 1);
				viewData.memberRolesIncludedInMenu.splice(roleInMenuIndex, 1);
			}
		} else {
			if (
				viewData.category.maximum !== undefined &&
				viewData.category.maximum !== 1 &&
				viewData.memberRolesIncludedInMenu.length >= viewData.category.maximum
			) {
				const strings = constants.contexts.roleLimitReached({
					localise: this.#client.localise,
					locale: selection.displayLocale,
				});
				this.#client
					.notice(selection, {
						title: strings.title,
						description: `${strings.description.limitReached}\n\n${strings.description.toChooseNew}`,
					})
					.ignore();

				await this.#traverseRoleTreeAndDisplay(selection, {
					editResponse: true,
				});

				return;
			}

			await this.#client.bot.helpers
				.addRole(selection.guildId, selection.user.id, role.id, "User-requested role addition.")
				.catch((error) =>
					this.#client.log.warn(
						error,
						`Failed to add ${this.#client.diagnostics.role(role)} to ${this.#client.diagnostics.user(
							selection.user,
						)} on ${this.#client.diagnostics.guild(selection.guildId)}.`,
					),
				);

			if (viewData.category.maximum === 1) {
				for (const memberRoleId of viewData.memberRolesIncludedInMenu) {
					this.#client.bot.helpers
						.removeRole(selection.guildId, selection.user.id, memberRoleId)
						.catch((error) =>
							this.#client.log.warn(
								error,
								`Failed to remove ${this.#client.diagnostics.role(role)} from ${this.#client.diagnostics.user(
									selection.user,
								)} on ${this.#client.diagnostics.guild(selection.guildId)}.`,
							),
						);

					const roleId = this.roleData.memberRoleIds.findIndex((roleId) => roleId === memberRoleId);

					this.roleData.memberRoleIds.splice(roleId, 1);
				}
				viewData.memberRolesIncludedInMenu = [];
			}

			this.roleData.memberRoleIds.push(role.id);
			this.viewData?.memberRolesIncludedInMenu.push(role.id);
		}

		await this.#traverseRoleTreeAndDisplay(selection, { editResponse: true });
	}

	/**
	 * Traverses the role category tree and returns the role category the user is
	 * viewing currently.
	 *
	 * @param data - Navigation data for the selection menu.
	 * @returns The category the user is now viewing.
	 */
	#traverseRoleSelectionTree(): [RoleCategory, ...RoleCategory[]] {
		const categories: [RoleCategory, ...RoleCategory[]] = [this.#root];
		for (const next of this.#history) {
			const lastCategoryGroup = categories.at(-1) as RoleCategoryGroup | undefined;
			if (lastCategoryGroup === undefined) {
				throw new Error("Could not get the last role category group when traversing the role selection tree.");
			}

			const lastCategory = lastCategoryGroup.categories[next];
			if (lastCategory === undefined) {
				throw new Error("Could not get the last role category when traversing the role selection tree.");
			}

			categories.push(lastCategory);
		}

		return categories;
	}

	async #traverseRoleTreeAndDisplay(
		interaction: Rost.Interaction,
		{ editResponse }: { editResponse: boolean },
	): Promise<void> {
		const categories = this.#traverseRoleSelectionTree();
		const category = categories.at(-1);
		if (category === undefined) {
			throw new Error("Could not get the last role category.");
		}

		let selectOptions: Discord.SelectOption[];
		if (isSingle(category)) {
			const menuRoles = getRoles(category.collection, interaction.guildId);
			const snowflakes = ((): [string, bigint][] => {
				const collection = category.collection;
				if (isCustom(collection)) {
					return (Object.entries(menuRoles) as [string, RoleCustom][]).map(([name, role]) => [
						name,
						BigInt(role.snowflake),
					]);
				}

				return (Object.entries(menuRoles) as [string, RoleImplicit][]).map(([name, role]) => {
					const snowflake = role.snowflakes[interaction.guildId.toString()];
					if (snowflake === undefined) {
						throw new Error(
							`Could not get the snowflake for a role on ${this.#client.diagnostics.guild(interaction.guildId)}.`,
						);
					}

					return [name, BigInt(snowflake)];
				});
			})();
			const menuRolesResolved = Object.fromEntries(
				snowflakes.map<[string, Rost.Role | undefined]>(([name, snowflake]) => [
					name,
					this.roleData.rolesById.get(snowflake),
				]),
			);
			const memberRolesIncludedInMenu = Object.values(menuRolesResolved)
				.filter(isDefined)
				.filter((role) => this.roleData.memberRoleIds.some((roleId) => role.id === roleId))
				.map((role) => role.id);

			this.viewData = { category, menuRoles, menuRolesResolved, memberRolesIncludedInMenu };

			selectOptions = this.#createSelectOptionsFromCollection(interaction);
		} else {
			if (this.viewData === undefined) {
				this.viewData = { category, menuRoles: {}, menuRolesResolved: {}, memberRolesIncludedInMenu: [] };
			}

			selectOptions = this.#createSelectOptionsFromCategories(interaction, category.categories);
		}

		this.viewData.category = category;

		const menu = await this.#displaySelectMenu(interaction, categories, selectOptions);

		if (editResponse) {
			await this.#client.editReply(interaction, menu);
			return;
		}

		this.#client.reply(interaction, menu).ignore();
	}

	async #displaySelectMenu(
		interaction: Rost.Interaction,
		categories: [RoleCategory, ...RoleCategory[]],
		selectOptions: Discord.SelectOption[],
	): Promise<Discord.InteractionCallbackData> {
		const isInRootCategory = this.#history.length === 0;
		if (!isInRootCategory) {
			const strings = constants.contexts.previousRoleCategory({
				localise: this.#client.localise,
				locale: interaction.displayLocale,
			});

			selectOptions.push({ label: trim(strings.back, 25), value: constants.special.roles.back });
		}

		const category = categories.at(-1);
		if (category === undefined) {
			throw new Error("Could not get the last role category.");
		}

		const strings = {
			...constants.contexts.roleMenu({ localise: this.#client.localise, locale: interaction.displayLocale }),
			...constants.contexts.role({
				localise: this.#client.localise,
				localiseRaw: this.#client.localiseRaw,
				locale: interaction.displayLocale,
			}),
		};
		const title = (categories.length > 1 ? categories.slice(1) : categories)
			.map((category) => `${category.emoji}  ${strings.name({ id: category.id })}`)
			.join(` ${constants.emojis.commands.profile.roles.directory}  `);

		return {
			embeds: [
				{
					title,
					description: strings.description({ id: category.id }),
					color: category.color,
				},
			],
			components: [
				{
					type: Discord.MessageComponentTypes.ActionRow,
					components: [
						{
							type: Discord.MessageComponentTypes.SelectMenu,
							customId: this.#selections.customId,
							options: selectOptions,
							placeholder: isGroup(category) ? strings.chooseCategory : strings.chooseRole,
						},
					],
				},
			],
		};
	}

	#createSelectOptionsFromCategories(
		interaction: Rost.Interaction,
		categories: Record<string, RoleCategory>,
	): Discord.SelectOption[] {
		const categorySelections = getRoleCategories(categories, interaction.guildId);

		const selections: Discord.SelectOption[] = [];
		for (const [name, category] of Object.entries(categorySelections)) {
			const strings = constants.contexts.roleCategory({
				localise: this.#client.localise,
				locale: interaction.displayLocale,
			});
			selections.push({
				label: trim(`${category.emoji} ${strings.name({ id: category.id })}`, 25),
				value: name,
				description: trim(strings.description({ id: category.id }), 100),
				emoji: { name: constants.emojis.roles.folder },
			});
		}

		return selections;
	}

	#createSelectOptionsFromCollection(interaction: Rost.Interaction): Discord.SelectOption[] {
		const selectOptions: Discord.SelectOption[] = [];

		const viewData = this.viewData;
		if (viewData === undefined) {
			return [{ label: "?", value: constants.components.none }];
		}

		for (const name of Object.keys(viewData.menuRoles)) {
			const [role, roleResolved] = [viewData.menuRoles[name], viewData.menuRolesResolved[name]];
			if (role === undefined || roleResolved === undefined) {
				continue;
			}

			const memberHasRole = viewData.memberRolesIncludedInMenu.includes(roleResolved.id);

			const strings = {
				...constants.contexts.assignedRoles({
					localise: this.#client.localise,
					locale: interaction.displayLocale,
				}),
				...constants.contexts.role({
					localise: this.#client.localise,
					localiseRaw: this.#client.localiseRaw,
					locale: interaction.displayLocale,
				}),
			};
			selectOptions.push({
				label: trim(
					memberHasRole
						? `[${strings.assigned}] ${strings.name({ id: role.id })}`
						: strings.name({ id: role.id }),
					25,
				),
				value: name,
				description:
					strings.description({ id: role.id }) !== undefined
						? trim(strings.description({ id: role.id })!, 100)
						: undefined,
				emoji: (() => {
					if (role.emoji === undefined) {
						return;
					}

					if (constants.patterns.emojiExpression.test(role.emoji)) {
						return { name: role.emoji };
					}

					const id = this.roleData.emojiIdsByName.get(role.emoji);
					if (id === undefined) {
						return { name: constants.emojis.roles.noCategory };
					}

					return { name: role.emoji, id };
				})(),
			});
		}

		return selectOptions;
	}
}

export { RoleSelectionComponent };
