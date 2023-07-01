function pluralise(quantity: string, { one, two, many }: Record<string, string> = {}): string {
	// 1 is the only positive number the singular form goes with in Romanian.
	if (quantity === "1") {
		return one ?? "?";
	}

	// Until the number 20, Romanian nouns follow the standard number + plural rule.
	if (parseInt(quantity) < 20) {
		return two ?? "?";
	}

	// Once the number reaches 20, Romanian begins slotting a 'de' between the number and the plural form of the word.
	return many ?? "?";
}

export { pluralise };
export default { pluralise };
