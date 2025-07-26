import patterns from "rost:constants/patterns";

/**
 * Parses a 6-digit hex value prefixed with a hashtag to a number.
 *
 * @param colour - The color represented as a 6-digit hexadecimal value prefixed
 * with a hashtag.
 * @returns The decimal form.
 */
function fromHex(colour: string): number {
	if (!patterns.rgbHex.test(colour)) {
		throw new Error("The passed colour was not in the correct format (#ffffff).");
	}

	return Number.parseInt(colour.replace("#", "0x"));
}

export default Object.freeze({
	// Special
	invisible: fromHex("#36393f"), // Used to blend in with the rest of an embed.
	// Reply methods
	unsupported: fromHex("#d6e3f8"),
	notice: fromHex("#6269ed"),
	success: fromHex("#89ef59"),
	pushback: fromHex("#ff9a76"),
	warning: fromHex("#f2f277"),
	error: fromHex("#ff4b3e"),
	failure: fromHex("#820000"),
	death: fromHex("#1c1c1c"),
	// Random colours.
	red: fromHex("#b42f2f"),
	darkRed: fromHex("#820000"),
	lightGreen: fromHex("#89ef59"),
	darkGreen: fromHex("#479621"),
	blue: fromHex("#6269ed"),
	dullYellow: fromHex("#f2f277"),
	gray: fromHex("#637373"),
	peach: fromHex("#ff9a76"),
	husky: fromHex("#d6e3f8"),
	murrey: fromHex("#87255b"),
	black: fromHex("#1c1c1c"),
	yellow: fromHex("#ffe548"),
	orangeRed: fromHex("#ff4b3e"),
	lightGray: fromHex("#daddd8"),
	turquoise: fromHex("#68d8d6"),
	green: fromHex("#00cc66"),
	greenishLightGray: fromHex("#c5e0d8"),
	orange: fromHex("#f28123"),
} as const);
export { fromHex };
