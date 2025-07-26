import colours from "rost:constants/colours";
import emojis from "rost:constants/emojis";

const roles = Object.freeze({
	language: {
		type: "group",
		id: "roles.language",
		color: colours.gray,
		emoji: emojis.roles.categories.language.category,
		categories: {
			proficiency: {
				type: "single",
				id: "roles.language.categories.proficiency",
				color: colours.gray,
				emoji: emojis.roles.categories.language.proficiency.category,
				minimum: 1,
				maximum: 1,
				collection: {
					type: "implicit",
					list: {
						beginner: {
							id: "roles.language.categories.proficiency.roles.beginner",
							emoji: emojis.roles.categories.language.proficiency.beginner,
							snowflakes: {
								"910929726418350110": "910929726535774253",
								"432173040638623746": "432204106615095307",
								"1175841125546856608": "1175841125630750727",
								"1175841481089634476": "1175841481550999661",
							},
						},
						intermediate: {
							id: "roles.language.categories.proficiency.roles.intermediate",
							emoji: emojis.roles.categories.language.proficiency.intermediate,
							snowflakes: {
								"910929726418350110": "910929726535774254",
								"432173040638623746": "432176435311149056",
								"1175841125546856608": "1175841125630750728",
								"1175841481089634476": "1175841481550999662",
							},
						},
						advanced: {
							id: "roles.language.categories.proficiency.roles.advanced",
							emoji: emojis.roles.categories.language.proficiency.advanced,
							snowflakes: {
								"910929726418350110": "910929726535774255",
								"432173040638623746": "432176480269631502",
								"1175841125546856608": "1175841125630750729",
								"1175841481089634476": "1175841481571967097",
							},
						},
						native: {
							id: "roles.language.categories.proficiency.roles.native",
							emoji: emojis.roles.categories.language.proficiency.native,
							snowflakes: {
								"910929726418350110": "910929726535774256",
								"432173040638623746": "432175772623437825",
								"1175841125546856608": "1175841125651718174",
								"1175841481089634476": "1175841481571967098",
							},
						},
					},
				},
			},
			cefr: {
				type: "single",
				id: "roles.language.categories.cefr",
				color: colours.blue,
				emoji: emojis.roles.categories.language.cefr.category,
				maximum: 1,
				collection: {
					type: "implicit",
					list: {
						a0: {
							id: "roles.language.categories.cefr.roles.a0",
							emoji: emojis.roles.categories.language.cefr.a0,
							snowflakes: {
								"910929726418350110": "1095053872059400332",
								"432173040638623746": "1095052477100998676",
								"1175841125546856608": "1175841125630750725",
								"1175841481089634476": "1175841481550999659",
							},
						},
						a1: {
							id: "roles.language.categories.cefr.roles.a1",
							emoji: emojis.roles.categories.language.cefr.a1,
							snowflakes: {
								"910929726418350110": "1095053893299347466",
								"432173040638623746": "1095052646441824408",
								"1175841125546856608": "1175841125630750724",
								"1175841481089634476": "1175841481550999658",
							},
						},
						a2: {
							id: "roles.language.categories.cefr.roles.a2",
							emoji: emojis.roles.categories.language.cefr.a2,
							snowflakes: {
								"910929726418350110": "1095053911414554625",
								"432173040638623746": "1095052690033217577",
								"1175841125546856608": "1175841125630750723",
								"1175841481089634476": "1175841481550999657",
							},
						},
						b1: {
							id: "roles.language.categories.cefr.roles.b1",
							emoji: emojis.roles.categories.language.cefr.b1,
							snowflakes: {
								"910929726418350110": "1095053921589923851",
								"432173040638623746": "1095052828340400148",
								"1175841125546856608": "1175841125630750722",
								"1175841481089634476": "1175841481550999656",
							},
						},
						b2: {
							id: "roles.language.categories.cefr.roles.b2",
							emoji: emojis.roles.categories.language.cefr.b2,
							snowflakes: {
								"910929726418350110": "1095053935686991892",
								"432173040638623746": "1095052854739345460",
								"1175841125546856608": "1175841125630750721",
								"1175841481089634476": "1175841481550999655",
							},
						},
						c1: {
							id: "roles.language.categories.cefr.roles.c1",
							emoji: emojis.roles.categories.language.cefr.c1,
							snowflakes: {
								"910929726418350110": "1095053946097242236",
								"432173040638623746": "1095052882979598427",
								"1175841125546856608": "1175841125630750720",
								"1175841481089634476": "1175841481550999654",
							},
						},
						c2: {
							id: "roles.language.categories.cefr.roles.c2",
							emoji: emojis.roles.categories.language.cefr.c2,
							snowflakes: {
								"910929726418350110": "1095053955207282808",
								"432173040638623746": "1095052905637224520",
								"1175841125546856608": "1175841125605572760",
								"1175841481089634476": "1175841481550999653",
							},
						},
					},
				},
			},
		},
	},
	learning: {
		type: "single",
		id: "roles.learning",
		color: colours.lightGray,
		emoji: emojis.roles.categories.learning.category,
		collection: {
			type: "implicit",
			list: {
				correctMe: {
					id: "roles.learning.roles.correctMe",
					emoji: emojis.roles.categories.learning.correctMe,
					snowflakes: {
						"910929726418350110": "910929726485434397",
						"432173040638623746": "841405470337269761",
						"1175841125546856608": "1175841125605572758",
						"1175841481089634476": "1175841481530036302",
					},
				},
				doNotCorrectMe: {
					id: "roles.learning.roles.doNotCorrectMe",
					emoji: emojis.roles.categories.learning.doNotCorrectMe,
					snowflakes: {
						"910929726418350110": "1183179255144796192",
						"432173040638623746": "1183178246112677969",
						"1175841125546856608": "1183367415824908319",
						"1175841481089634476": "1183367622507634698",
					},
				},
				classroomAttendee: {
					id: "roles.learning.roles.classroomAttendee",
					emoji: emojis.roles.categories.learning.classroomAttendee,
					snowflakes: {
						"910929726418350110": "910929726485434394",
						"432173040638623746": "725653430848323584",
						"1175841125546856608": "1175841125605572756",
						"1175841481089634476": "1175841481530036300",
					},
				},
				dailyPhrase: {
					id: "roles.learning.roles.dailyPhrase",
					emoji: emojis.roles.categories.learning.dailyPhrase,
					snowflakes: {
						"910929726418350110": "910929726485434396",
						"432173040638623746": "532177259574853632",
						"1175841125546856608": "1175841125605572755",
						"1175841481089634476": "1175841481530036299",
					},
				},
				voicechatter: {
					id: "roles.learning.roles.voicechatter",
					emoji: emojis.roles.categories.learning.voicechatter,
					snowflakes: {
						"910929726418350110": "910929726485434395",
						"432173040638623746": "692489433232048189",
						"1175841125546856608": "1175841125605572757",
						"1175841481089634476": "1175841481530036301",
					},
				},
			},
		},
	},
	dialects: {
		type: "single",
		id: "roles.dialects",
		color: colours.green,
		emoji: emojis.roles.categories.dialects.category,
		collection: {
			type: "custom",
			lists: {
				"910929726418350110": {
					western: { id: "roles.dialects.languages.armenian.roles.western", snowflake: "982407478761381898" },
					eastern: { id: "roles.dialects.languages.armenian.roles.eastern", snowflake: "982407372733579305" },
					karabakh: {
						id: "roles.dialects.languages.armenian.roles.karabakh",
						snowflake: "1041345453360423033",
					},
					classical: {
						id: "roles.dialects.languages.armenian.roles.classical",
						snowflake: "1134470894530605076",
					},
				},
			},
		},
	},
	personalisation: {
		type: "group",
		id: "roles.personalisation",
		color: colours.yellow,
		emoji: emojis.roles.categories.personalisation.category,
		categories: {
			orthography: {
				type: "single",
				id: "roles.personalisation.categories.orthography",
				color: colours.husky,
				emoji: emojis.roles.categories.personalisation.orthography.category,
				maximum: 1,
				collection: {
					type: "custom",
					lists: {
						"432173040638623746": {
							idinist: {
								id: "roles.personalisation.categories.orthography.roles.idinist",
								emoji: emojis.roles.categories.personalisation.orthography.idinist,
								snowflake: "1017445191159906344",
							},
						},
					},
				},
			},
			gender: {
				type: "single",
				id: "roles.personalisation.categories.gender",
				color: colours.orangeRed,
				emoji: emojis.roles.categories.personalisation.gender.category,
				maximum: 1,
				collection: {
					type: "implicit",
					list: {
						male: {
							id: "roles.personalisation.categories.gender.roles.male",
							emoji: emojis.roles.categories.personalisation.gender.male,
							snowflakes: {
								"910929726418350110": "910929726535774252",
								"432173040638623746": "907693256882655312",
								"1175841125546856608": "1175841125605572751",
								"1175841481089634476": "1175841481530036295",
							},
						},
						female: {
							id: "roles.personalisation.categories.gender.roles.female",
							emoji: emojis.roles.categories.personalisation.gender.female,
							snowflakes: {
								"910929726418350110": "910929726535774251",
								"432173040638623746": "907693786245759046",
								"1175841125546856608": "1175841125584609430",
								"1175841481089634476": "1175841481530036294",
							},
						},
						nonBinary: {
							id: "roles.personalisation.categories.gender.roles.nonBinary",
							emoji: emojis.roles.categories.personalisation.gender.nonbinary,
							snowflakes: {
								"910929726418350110": "910929726535774249",
								"432173040638623746": "907693861327999097",
								"1175841125546856608": "1175841125584609428",
								"1175841481089634476": "1175841481513246759",
							},
						},
					},
				},
			},
			abroad: {
				type: "single",
				id: "roles.personalisation.categories.abroad",
				color: colours.husky,
				emoji: emojis.roles.categories.personalisation.abroad.category,
				collection: {
					type: "implicit",
					list: {
						diasporan: {
							id: "roles.personalisation.categories.abroad.roles.diasporan",
							emoji: emojis.roles.categories.personalisation.abroad.diasporan,
							snowflakes: {
								"910929726418350110": "910929726485434398",
								"432173040638623746": "773215783857815552",
								"1175841125546856608": "1175841125584609426",
								"1175841481089634476": "1175841481513246757",
							},
						},
					},
				},
			},
		},
	},
	regions: {
		type: "single",
		id: "roles.regions",
		color: colours.greenishLightGray,
		emoji: emojis.roles.categories.regions.category,
		maximum: 2,
		collection: {
			type: "custom",
			lists: {
				"910929726418350110": {
					aragatsotn: {
						id: "roles.regions.languages.armenian.roles.aragatsotn",
						snowflake: "910929726485434390",
					},
					ararat: { id: "roles.regions.languages.armenian.roles.ararat", snowflake: "910929726485434389" },
					armavir: { id: "roles.regions.languages.armenian.roles.armavir", snowflake: "910929726418350119" },
					gegharkunik: {
						id: "roles.regions.languages.armenian.roles.gegharkunik",
						snowflake: "910929726418350118",
					},
					kotayk: { id: "roles.regions.languages.armenian.roles.kotayk", snowflake: "910929726418350117" },
					lorri: { id: "roles.regions.languages.armenian.roles.lorri", snowflake: "910929726418350116" },
					shirak: { id: "roles.regions.languages.armenian.roles.shirak", snowflake: "910929726418350115" },
					syunik: { id: "roles.regions.languages.armenian.roles.syunik", snowflake: "910929726418350114" },
					tavush: { id: "roles.regions.languages.armenian.roles.tavush", snowflake: "910929726418350113" },
					vayotsdzor: {
						id: "roles.regions.languages.armenian.roles.vayotsdzor",
						snowflake: "911049518110367814",
					},
					yerevan: { id: "roles.regions.languages.armenian.roles.yerevan", snowflake: "911049617385332796" },
				},
				"432173040638623746": {
					banat: { id: "roles.regions.languages.romanian.roles.banat", snowflake: "751155382428106814" },
					basarabia: {
						id: "roles.regions.languages.romanian.roles.basarabia",
						snowflake: "828604051754844180",
					},
					bucovina: {
						id: "roles.regions.languages.romanian.roles.bucovina",
						snowflake: "751155753846309035",
					},
					crisana: { id: "roles.regions.languages.romanian.roles.crisana", snowflake: "751155320272978111" },
					dobrogea: {
						id: "roles.regions.languages.romanian.roles.dobrogea",
						snowflake: "751157249262616598",
					},
					maramures: {
						id: "roles.regions.languages.romanian.roles.maramures",
						snowflake: "751156107229266101",
					},
					moldova: { id: "roles.regions.languages.romanian.roles.moldova", snowflake: "751155723836325908" },
					muntenia: {
						id: "roles.regions.languages.romanian.roles.muntenia",
						snowflake: "751155609906446378",
					},
					oltenia: { id: "roles.regions.languages.romanian.roles.oltenia", snowflake: "751155517199482892" },
					transilvania: {
						id: "roles.regions.languages.romanian.roles.transilvania",
						snowflake: "751155021344669769",
					},
				},
			},
		},
	},
	ethnicity: {
		type: "single",
		id: "roles.ethnicity",
		color: colours.turquoise,
		emoji: emojis.roles.categories.ethnicity.category,
		maximum: 2,
		collection: {
			type: "custom",
			lists: {
				"910929726418350110": {
					armenoTat: {
						id: "roles.ethnicity.languages.armenian.roles.armenoTat",
						snowflake: "910929726485434393",
					},
					circassian: {
						id: "roles.ethnicity.languages.armenian.roles.circassian",
						snowflake: "910929726485434392",
					},
					hemshin: {
						id: "roles.ethnicity.languages.armenian.roles.hemshin",
						snowflake: "910929726485434391",
					},
					cryptoArmenian: {
						id: "roles.ethnicity.languages.armenian.roles.cryptoArmenian",
						snowflake: "910929726418350112",
					},
				},
				"432173040638623746": {
					aromanian: {
						id: "roles.ethnicity.languages.romanian.roles.aromanian",
						snowflake: "778021019302101024",
					},
					istroRomanian: {
						id: "roles.ethnicity.languages.romanian.roles.istroRomanian",
						snowflake: "778020962482126858",
					},
					meglenoRomanian: {
						id: "roles.ethnicity.languages.romanian.roles.meglenoRomanian",
						snowflake: "778021019180859413",
					},
					romani: { id: "roles.ethnicity.languages.romanian.roles.romani", snowflake: "1055458867200393216" },
					hungarian: {
						id: "roles.ethnicity.languages.romanian.roles.hungarian",
						snowflake: "1055458896317255680",
					},
					german: { id: "roles.ethnicity.languages.romanian.roles.german", snowflake: "1055458905792188518" },
				},
			},
		},
	},
} as const satisfies Record<string, RoleCategory>);

/** Represents a selectable role within a role selection menu.  */
interface RoleBase {
	id: string;

	/** Emoji to be displayed next to the role name. */
	emoji?: string;
}

interface RoleImplicit extends RoleBase {
	snowflakes: Record<string, string>;
}

interface RoleCustom extends RoleBase {
	snowflake: string;
}

type Role = RoleImplicit | RoleCustom;

/** The type of role category. */
type RoleCategoryTypes =
	/** A standalone role category. */
	| "single"
	/** A role category acting as a thematic grouping for other role categories. */
	| "group";

/**
 * The base of a role category.
 *
 * This type defines the core properties that all role categories must define.
 */
interface RoleCategoryBase {
	/** The type of this category. */
	type: RoleCategoryTypes;

	/** This category's identifier. */
	id: string;

	/** The colour to be displayed in the embed message when this category is selected. */
	color: number;

	/** The emoji to be displayed next to this category in the select menu. */
	emoji: string;
}

/** The base of a role category. */
interface RoleCategorySingle extends RoleCategoryBase {
	type: "single";

	collection: RoleCollection;

	maximum?: number;
	minimum?: number;
}

/** The base of a group of role categories. */
interface RoleCategoryGroup extends RoleCategoryBase {
	type: "group";

	/** The subcategories in this role category. */
	categories: Record<string, RoleCategory>;
}

/** Represents a thematic selection of {@link Role}s. */
type RoleCategory = RoleCategorySingle | RoleCategoryGroup;

function isSingle(category: RoleCategory): category is RoleCategorySingle {
	return category.type === "single";
}

function isGroup(category: RoleCategory): category is RoleCategoryGroup {
	return category.type === "group";
}

/** The type of role collection. */
type RoleCollectionTypes =
	/** A collection of roles. */
	| "implicit"
	/** A group of role collections that differ depending on the guild. */
	| "custom";

/**
 * The base of a role collection.
 *
 * This type defines the core properties that all role collections must define.
 */
type RoleCollectionBase = {
	/** The type of this collection. */
	type: RoleCollectionTypes;
};

/** The base of an implicit role collection. */
interface RoleCollectionImplicit extends RoleCollectionBase {
	type: "implicit";

	/** The roles in this role collection. */
	list: Record<string, RoleImplicit>;
}

/** The base of a custom role collection. */
interface RoleCollectionCustom extends RoleCollectionBase {
	type: "custom";

	/** Groups of roles defined by guild ID in this role collection. */
	lists: Record<string, Record<string, RoleCustom>>;
}

/** Represents a grouping of roles. */
type RoleCollection = RoleCollectionImplicit | RoleCollectionCustom;

function isImplicit(collection: RoleCollection): collection is RoleCollectionImplicit {
	return collection.type === "implicit";
}

function isCustom(collection: RoleCollection): collection is RoleCollectionCustom {
	return collection.type === "custom";
}

function getRoleCategories(categories: Record<string, RoleCategory>, guildId: bigint): Record<string, RoleCategory> {
	const guildIdString = guildId.toString();

	const selectedRoleCategories: Record<string, RoleCategory> = {};

	for (const [name, category] of Object.entries(categories)) {
		if (isGroup(category)) {
			selectedRoleCategories[name] = category;
			continue;
		}

		if (isCustom(category.collection) && !(guildIdString in category.collection.lists)) {
			continue;
		}

		selectedRoleCategories[name] = category;
	}

	return selectedRoleCategories;
}

/** Extracts the list of roles from within a role collection and returns it. */
function getRoles(collection: RoleCollection, guildId: bigint): Record<string, Role> {
	if (isImplicit(collection)) {
		return collection.list;
	}

	const guildIdString = guildId.toString();

	return collection.lists[guildIdString] ?? {};
}

export default roles;
export { isCustom, isGroup, isImplicit, isSingle, getRoleCategories, getRoles };
export type {
	Role,
	RoleCategory,
	RoleCategoryBase,
	RoleCategoryGroup,
	RoleCategorySingle,
	RoleCollection,
	RoleCollectionImplicit,
	RoleCustom,
	RoleImplicit,
};
