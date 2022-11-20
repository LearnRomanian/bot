import { SelectOption } from 'discordeno';
import { Language } from '../../../../types.ts';
import { trim } from '../../../../utils.ts';
import { RoleCollection, RoleCollectionTypes } from './role-collection.ts';
import { Localisations, localise } from '../../../../../assets/localisations/types.ts';

/** The type of role category. */
enum RoleCategoryTypes {
	/** A role category acting as a thematic grouping for other role categories. */
	CategoryGroup,

	/** A standalone role category. */
	Category,
}

/**
 * The base of a role category.
 *
 * This type defines the core properties that all role categories must define.
 */
type RoleCategoryBase = {
	/** The type of this category. */
	type: RoleCategoryTypes;

	/** The display name of this category. */
	name: Localisations<string>;

	/** A description for what roles or role categories this role category contains. */
	description: Localisations<string>;

	/** The colour to be displayed in the embed message when this category is selected. */
	color: number;

	/** The emoji to be displayed next to this category in the select menu. */
	emoji: string;
};

/** The base of a group of role categories. */
type RoleCategoryGroup = {
	type: RoleCategoryTypes.CategoryGroup;

	/** The subcategories in this role category. */
	categories: RoleCategory[];
};

/** The base of a standalone role category. */
type RoleCategoryStandalone<
	T = SingleAssignableRoleCategory | MultipleAssignableRoleCategory,
> = {
	type: RoleCategoryTypes.Category;

	/** Whether or not only one role can be selected from this category. */
	restrictToOneRole: boolean;
} & T;

/** A role category that allows only one role to be selected from it at any one time. */
type SingleAssignableRoleCategory = {
	// Because only one role can be selected at any one time from this category, and
	// once a role has been selected, it cannot be unselected again, the message to be
	// shown when a role is unassigned will never be shown to the user.
	collection: RoleCollection;

	restrictToOneRole: true;
};

/** A role category that allows more than one role to be selected from it. */
type MultipleAssignableRoleCategory = {
	collection: RoleCollection;

	restrictToOneRole: false;

	/** The maximum number of roles that can be selected from this category. */
	limit?: number;
};

/** Represents a thematic selection of {@link Role}s. */
type RoleCategory =
	& RoleCategoryBase
	& (
		| RoleCategoryGroup
		| RoleCategoryStandalone
	);

function createSelectOptionsFromCategories(
	categories: RoleCategory[],
	language: Language | undefined,
	locale: string | undefined,
): SelectOption[] {
	const categorySelections = getRelevantCategories(categories, language);

	const selections: SelectOption[] = [];
	for (const [category, index] of categorySelections) {
		selections.push({
			label: localise(category.name, locale),
			value: index.toString(),
			description: trim(localise(category.description, locale), 100),
			emoji: { name: category.emoji },
		});
	}

	return selections;
}

function getRelevantCategories(
	categories: RoleCategory[],
	language: Language | undefined,
): [RoleCategory, number][] {
	const selectedRoleCategories: [RoleCategory, number][] = [];

	for (let index = 0; index < categories.length; index++) {
		const category = categories.at(index)!;

		if (category.type === RoleCategoryTypes.CategoryGroup) {
			selectedRoleCategories.push([category, index]);
			continue;
		}

		if (category.collection.type === RoleCollectionTypes.CollectionLocalised) {
			if (!language) continue;
			if (!(language in category.collection.lists)) continue;
		}

		selectedRoleCategories.push([category, index]);
	}

	return selectedRoleCategories;
}

export { createSelectOptionsFromCategories, getRelevantCategories, RoleCategoryTypes };
export type { RoleCategory, RoleCategoryBase, RoleCategoryStandalone };
