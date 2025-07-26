import pluralisers from "rost:constants/transformers/pluralisers";

type TransformerType = "pluralise";
type Transformer = (matchTerm: string, matches: Record<string, string>) => string | undefined;

const localisations = Object.freeze({
	transformers: {
		da: { pluralise: pluralisers.commonEuropean },
		nl: { pluralise: pluralisers.commonEuropean },
		"en-US": { pluralise: pluralisers.commonEuropean },
		"en-GB": { pluralise: pluralisers.commonEuropean },
		fi: { pluralise: pluralisers.commonEuropean },
		fr: { pluralise: pluralisers.commonEuropean },
		de: { pluralise: pluralisers.commonEuropean },
		el: { pluralise: pluralisers.commonEuropean },
		hu: { pluralise: pluralisers.invariant },
		no: { pluralise: pluralisers.commonEuropean },
		pl: { pluralise: pluralisers.commonSlavic },
		ro: { pluralise: pluralisers.romanian },
		ru: { pluralise: pluralisers.commonSlavic },
		"es-ES": { pluralise: pluralisers.commonEuropean },
		"sv-SE": { pluralise: pluralisers.commonEuropean },
		tr: { pluralise: pluralisers.invariant },
		id: { pluralise: pluralisers.unsupported },
		"es-419": { pluralise: pluralisers.unsupported },
		hr: { pluralise: pluralisers.unsupported },
		it: { pluralise: pluralisers.unsupported },
		lt: { pluralise: pluralisers.unsupported },
		"pt-BR": { pluralise: pluralisers.unsupported },
		vi: { pluralise: pluralisers.unsupported },
		cs: { pluralise: pluralisers.unsupported },
		bg: { pluralise: pluralisers.unsupported },
		uk: { pluralise: pluralisers.unsupported },
		hi: { pluralise: pluralisers.unsupported },
		th: { pluralise: pluralisers.unsupported },
		"zh-CN": { pluralise: pluralisers.unsupported },
		ja: { pluralise: pluralisers.unsupported },
		"zh-TW": { pluralise: pluralisers.unsupported },
		ko: { pluralise: pluralisers.unsupported },
	} satisfies Record<Discord.Locale, Record<TransformerType, Transformer>>,
} as const);

export default localisations;
export type { Transformer, TransformerType };
