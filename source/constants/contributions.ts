interface Contributor {
	readonly username: string;
	readonly id: string;
	readonly link?: string;
}

interface Translation {
	readonly flag: string;
	readonly completion: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
	readonly contributors: Contributor[];
}

const contributors = Object.freeze({
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
		link: "https://x.com/_stechi_",
	},
	aura: {
		username: "@adeniial",
		id: "868631133263376424",
	},
	eagely: {
		username: "@eagely",
		id: "747900197358665758",
	},
	estheroide: {
		username: "@estheroide",
		id: "747900197358665758",
	},
	kamelNeon: {
		username: "KamelNeoN#8068",
		id: "311489852824616961",
	},
	megaGlaceon: {
		username: "@megaglaceon",
		id: "186212508141355008",
		link: "https://github.com/a-mcego",
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
	hani: {
		username: "@hani_men12",
		id: "775308215470391317",
	},
	victor: {
		username: "@ferb02",
		id: "303605019532460033",
		link: "https://youtube.com/channel/UC4aqpjKwQfkqxmQO0Owy2QQ",
	},
	mike: {
		username: "@rottingrat666",
		id: "529666071498719242",
		link: "https://instagram.com/mike_dishakjian",
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
		link: "mailto:macmillantrenton@gmail.com",
	},
	vxern: {
		username: "@vxern",
		id: "217319536485990400",
		link: "https://linkedin.com/in/vxern",
	},
	pascu: {
		username: "@pseudonimeni",
		id: "768748522878533632",
	},
	mymy: {
		username: "@mymy1590",
		id: "859452448191545364",
	},
	theodeninmuhafizi: {
		username: "@theodeninmuhafizi",
		id: "1051504441087496252",
	},
	yeetfe: {
		username: "@yeetfe",
		id: "249248581435916299",
	},
} as const satisfies Record<string, Contributor>);

export default Object.freeze({
	translation: {
		"Armenian/Eastern": {
			flag: "🇦🇲",
			completion: 3,
			contributors: [contributors.mike, contributors["16wardm"]],
		},
		"Armenian/Western": {
			flag: "🇺🇳",
			completion: 5,
			contributors: [contributors["16wardm"]],
		},
		Dutch: {
			flag: "🇳🇱",
			completion: 7,
			contributors: [contributors.moorddroom],
		},
		Finnish: {
			flag: "🇫🇮",
			completion: 3,
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
			completion: 10,
			contributors: [contributors.rodutNotira],
		},
		Hungarian: {
			flag: "🇭🇺",
			completion: 4,
			contributors: [contributors.nemokosch],
		},
		"Norwegian/Bokmal": {
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
			completion: 10,
			contributors: [contributors.vxern, contributors.victor, contributors.kamelNeon],
		},
		Silesian: {
			flag: "🇺🇳",
			completion: 3,
			contributors: [contributors.okruchChleba, contributors.vxern],
		},
		Spanish: {
			flag: "🇪🇸",
			completion: 1,
			contributors: [contributors.aura, contributors.hani],
		},
		Swedish: {
			flag: "🇸🇪",
			completion: 1,
			contributors: [contributors.iiv, contributors.telemaniak],
		},
		Turkish: {
			flag: "🇹🇷",
			completion: 7,
			contributors: [contributors.yeetfe, contributors.theodeninmuhafizi],
		},
	} satisfies Record<string, Translation>,
} as const);
export { contributors };
export type { Contributor, Translation };
