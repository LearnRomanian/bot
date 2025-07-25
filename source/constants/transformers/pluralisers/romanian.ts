export default function pluralise(
	quantity: string,
	{ one: singular, two: pluralSmall, many: pluralLarge }: Record<string, string> = {},
): string | undefined {
	if (singular === undefined || pluralSmall === undefined || pluralLarge === undefined) {
		return undefined;
	}

	const unsignedQuantity = Math.abs(Number.parseInt(quantity));
	if (unsignedQuantity === 1) {
		return singular;
	}

	// If the last two digits make a number less than 20, Romanian nouns follow the standard number + plural rule.
	if (unsignedQuantity % 100 < 20) {
		return pluralSmall;
	}

	// Once the last two digits reach 20, Romanian begins slotting a 'de' between the number and the plural form of the word.
	return pluralLarge;
}
