import { Role as DiscordRole, SelectOption } from 'discordeno';
import { Commands } from '../../../../../assets/localisations/commands.ts';
import { localise } from '../../../../../assets/localisations/types.ts';
import { Language } from '../../../../types.ts';
import { Role } from './role.ts';

/** The type of role collection. */
enum RoleCollectionTypes {
	/** A collection of roles. */
	Collection,

	/** A group of role collections that differ depending on the language. */
	CollectionLocalised,
}

/**
 * The base of a role collection.
 *
 * This type defines the core properties that all role collections must define.
 */
type RoleCollectionBase = {
	/** The type of this collection. */
	type: RoleCollectionTypes;
};

/** The base of a role collection with a standalone group of roles. */
type RoleCollectionStandalone = {
	type: RoleCollectionTypes.Collection;

	/** The roles in this role collection. */
	list: Role[];
};

/** The base of a role collection with localised groups of roles. */
type RoleCollectionLocalised = {
	type: RoleCollectionTypes.CollectionLocalised;

	/** Groups of roles defined by language in this role collection. */
	lists: Partial<Record<Language, Role[]>>;
};

/** Represents a grouping of roles. */
type RoleCollection =
	& RoleCollectionBase
	& (RoleCollectionStandalone | RoleCollectionLocalised);

const emojiExpression = /\p{Extended_Pictographic}/u;

function createSelectOptionsFromCollection(
	menuRoles: Role[],
	menuRolesResolved: DiscordRole[],
	memberRolesIncludedInMenu: bigint[],
	emojiIdsByName: Map<string, bigint>,
	locale: string | undefined,
): SelectOption[] {
	const selectOptions: SelectOption[] = [];

	for (let index = 0; index < menuRoles.length; index++) {
		const [role, roleResolved] = [
			menuRoles.at(index)!,
			menuRolesResolved.at(index)!,
		];
		const memberHasRole = memberRolesIncludedInMenu.includes(roleResolved.id);

		const localisedName = localise(role.name, locale);

		selectOptions.push({
			label: memberHasRole
				? `[${localise(Commands.profile.options.roles.strings.assigned, locale)}] ${localisedName}`
				: localisedName,
			value: index.toString(),
			description: role.description ? localise(role.description, locale) : undefined,
			emoji: (() => {
				if (!role.emoji) return;
				if (emojiExpression.test(role.emoji)) return { name: role.emoji };

				const id = emojiIdsByName.get(role.emoji);
				if (!id) return { name: '❓' };

				return { name: role.emoji, id };
			})(),
		});
	}

	return selectOptions;
}

/**
 * Extracts the list of roles from within a role collection and returns it.
 *
 * @param collection - The collection from which to read the list of roles.
 * @param language - The language concerning the guild.
 * @returns The list of roles within the collection.
 */
function resolveRoles(
	collection: RoleCollection,
	language: Language | undefined,
): Role[] {
	if (collection.type === RoleCollectionTypes.CollectionLocalised) {
		if (!language) return [];

		return collection.lists[language] ?? [];
	}

	return collection.list;
}

export { createSelectOptionsFromCollection, resolveRoles, RoleCollectionTypes };
export type { RoleCollection };
