import { LearningLanguage } from "../languages";

type Contributor = {
	username: string;
	id: string;
	link?: string;
};

const contributors = {
	"16wardm": {
		username: "@16wardm",
		id: "758385691851096195",
	},
	alaska: {
		username: "@at.peace",
		id: "797369145367855104",
	},
	asterfields: {
		username: "@asterfields_",
		id: "839862207025119252",
		link: "https://instagram.com/asternight1",
	},
	balak: {
		username: "balak2609",
		id: "418818654529126400",
	},
	estheroide: {
		username: "@estheroide",
		id: "747900197358665758",
		link: "https://instagram.com/yosgatian",
	},
	kamelNeon: {
		username: "KamelNeoN#8068",
		id: "311489852824616961",
	},
	megaGlaceon: {
		username: "@megaglaceon",
		id: "186212508141355008",
	},
	nemokosch: {
		username: "@nemokosch",
		id: "297037173541175296",
		link: "https://github.com/2colours",
	},
	noxys: {
		username: "@noxyys",
		id: "357538166061924353",
	},
	okruchChleba: {
		username: "@okruchchleba",
		id: "403581106042961930",
	},
	rodutNotira: {
		username: "@rodutnotira",
		id: "502427080877801484",
	},
	spanish: {
		username: "@hani_men12",
		id: "775308215470391317",
	},
	victor: {
		username: "@ferb02",
		id: "303605019532460033",
		link: "https://youtube.com/channel/UC4aqpjKwQfkqxmQO0Owy2QQ",
	},
	moorddroom: {
		username: "@moorddroom",
		id: "656160896607059981",
	},
	iiv: {
		username: "@iiv",
		id: "99962686766333952",
	},
	telemaniak: {
		username: "@telemaniak",
		id: "410812091071725598",
	},
	vxern: {
		username: "@vxern",
		id: "217319536485990400",
		link: "https://linkedin.com/in/vxern",
	},
	theodeninmuhafizi: {
		username: "@theodeninmuhafizi",
		id: "1051504441087496252",
	},
	yeetfe: {
		username: "@yeetfe",
		id: "249248581435916299",
	},
} satisfies Record<string, Contributor>;

type Translation = {
	flag: string;
	completion: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
	contributors: Contributor[];
};

export default {
	translation: {
		"Armenian/Eastern": {
			flag: "🇦🇲",
			completion: 2,
			contributors: [contributors["16wardm"]],
		},
		"Armenian/Western": {
			flag: "🇺🇳",
			completion: 5,
			contributors: [contributors["16wardm"]],
		},
		Dutch: {
			flag: "🇳🇱",
			completion: 5,
			contributors: [contributors.moorddroom],
		},
		Finnish: {
			flag: "🇫🇮",
			completion: 0,
			contributors: [contributors.megaGlaceon],
		},
		French: {
			flag: "🇫🇷",
			completion: 8,
			contributors: [
				contributors["16wardm"],
				contributors.asterfields,
				contributors.noxys,
				contributors.moorddroom,
				contributors.alaska,
				contributors.estheroide,
			],
		},
		German: {
			flag: "🇩🇪",
			completion: 9,
			contributors: [contributors.rodutNotira],
		},
		Greek: {
			flag: "🇬🇷",
			completion: 0,
			contributors: [],
		},
		Hungarian: {
			flag: "🇭🇺",
			completion: 4,
			contributors: [contributors.nemokosch],
		},
		"Norwegian/Bokmål": {
			flag: "🇳🇴",
			completion: 8,
			contributors: [contributors.telemaniak],
		},
		Polish: {
			flag: "🇵🇱",
			completion: 10,
			contributors: [contributors.vxern],
		},
		Romanian: {
			flag: "🇷🇴",
			completion: 8,
			contributors: [contributors.vxern, contributors.victor, contributors.kamelNeon],
		},
		Russian: {
			flag: "🇷🇺",
			completion: 0,
			contributors: [],
		},
		Silesian: {
			flag: "🇺🇳",
			completion: 1,
			contributors: [contributors.okruchChleba, contributors.vxern],
		},
		Swedish: {
			flag: "🇸🇪",
			completion: 0,
			contributors: [contributors.iiv, contributors.telemaniak],
		},
		Turkish: {
			flag: "🇹🇷",
			completion: 7,
			contributors: [contributors.yeetfe, contributors.theodeninmuhafizi],
		},
	} satisfies Record<Exclude<LearningLanguage, "English/American" | "English/British">, Translation>,
};
export type { Contributor, Translation };
