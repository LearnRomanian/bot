import type { TimeUnit } from "rost:constants/time";
import type { Client } from "rost/client";

function parseTimeExpression(
	client: Client,
	interaction: Rost.Interaction,
	expression: string,
): [correctedExpression: string, period: number] | undefined {
	const conciseMatch = constants.patterns.conciseTimeExpression.exec(expression) ?? undefined;
	if (conciseMatch !== undefined) {
		const [_, hours, minutes, seconds] = conciseMatch;
		if (seconds === undefined) {
			throw new Error(
				`The expression '${expression}' was matched to the concise timestamp regular expression, but the seconds part was \`undefined\`.`,
			);
		}

		return parseConciseTimeExpression(client, interaction, [hours, minutes, seconds]);
	}

	return parseVerboseTimeExpressionPhrase(client, interaction, expression);
}

function parseConciseTimeExpression(
	client: Client,
	interaction: Rost.Interaction,
	parts: [hours: string | undefined, minutes: string | undefined, seconds: string],
): ReturnType<typeof parseTimeExpression> {
	const [seconds, minutes, hours] = parts
		.map((part) => (part !== undefined ? Number(part) : undefined))
		.reverse() as [number, ...number[]];

	const verboseExpressionParts: string[] = [];

	if (seconds !== 0) {
		const strings = {
			second: client.pluralise("units.second.word", interaction.locale, { quantity: seconds }),
		};

		verboseExpressionParts.push(strings.second);
	}

	if (minutes !== undefined && minutes !== 0) {
		const strings = {
			minute: client.pluralise("units.minute.word", interaction.locale, { quantity: minutes }),
		};

		verboseExpressionParts.push(strings.minute);
	}

	if (hours !== undefined && hours !== 0) {
		const strings = {
			hour: client.pluralise("units.hour.word", interaction.locale, { quantity: hours }),
		};

		verboseExpressionParts.push(strings.hour);
	}
	const verboseExpression = verboseExpressionParts.join(" ");

	const expressionParsed = parseVerboseTimeExpressionPhrase(client, interaction, verboseExpression);
	if (expressionParsed === undefined) {
		return undefined;
	}

	const conciseExpression = parts
		.map((part) => part ?? "0")
		.map((part) => (part.length === 1 ? `0${part}` : part))
		.join(":");

	const [verboseExpressionCorrected, period] = expressionParsed;

	return [`${conciseExpression} (${verboseExpressionCorrected})`, period];
}

const timeUnitsWithAliasesLocalised = new Map<string, Record<TimeUnit, string[]>>();

function parseVerboseTimeExpressionPhrase(
	client: Client,
	interaction: Rost.Interaction,
	expression: string,
): ReturnType<typeof parseTimeExpression> {
	if (!timeUnitsWithAliasesLocalised.has(interaction.locale)) {
		const timeUnits = Object.keys(constants.time) as TimeUnit[];
		const timeUnitAliasTuples: [TimeUnit, string[]][] = [];

		const strings = constants.contexts.timeUnit({ localise: client.localise, locale: interaction.locale });
		for (const timeUnit of timeUnits) {
			timeUnitAliasTuples.push([
				timeUnit,
				[
					strings.one(timeUnit),
					strings.two(timeUnit),
					strings.many(timeUnit),
					strings.short(timeUnit),
					strings.shortest(timeUnit),
				],
			]);
		}

		timeUnitsWithAliasesLocalised.set(
			interaction.locale,
			Object.fromEntries(timeUnitAliasTuples) as Record<TimeUnit, string[]>,
		);
	}

	const timeUnitsWithAliases = timeUnitsWithAliasesLocalised.get(interaction.locale);
	if (timeUnitsWithAliases === undefined) {
		throw new Error(`Failed to get time unit aliases for locale '${interaction.locale}'.`);
	}

	function extractNumbers(expression: string): number[] {
		const digitsExpression = new RegExp(/\d+/g);
		return (expression.match(digitsExpression) ?? []).map((digits) => Number(digits));
	}

	function extractStrings(expression: string): string[] {
		const stringsExpression = new RegExp(/\p{L}+/gu);
		return expression.match(stringsExpression) ?? [];
	}

	// Extract the digits present in the expression.
	const quantifiers = extractNumbers(expression).map((string) => Number(string));
	// Extract the strings present in the expression.
	const timeUnitAliases = extractStrings(expression);

	// No parameters have been provided for both keys and values.
	if (timeUnitAliases.length === 0 || quantifiers.length === 0) {
		return undefined;
	}

	// The number of values does not match the number of keys.
	if (quantifiers.length !== timeUnitAliases.length) {
		return undefined;
	}

	// One of the values is equal to 0.
	if (quantifiers.includes(0)) {
		return undefined;
	}

	const timeUnits: TimeUnit[] = [];
	for (const timeUnitAlias of timeUnitAliases) {
		const timeUnit = Object.entries(timeUnitsWithAliases).find(([_, aliases]) =>
			aliases.includes(timeUnitAlias),
		)?.[0];

		if (timeUnit === undefined) {
			return undefined;
		}

		timeUnits.push(timeUnit as TimeUnit);
	}

	// If one of the keys is duplicate.
	if (new Set(timeUnits).size !== timeUnits.length) {
		return undefined;
	}

	const timeUnitQuantifierTuples: [TimeUnit, number][] = [];
	for (const [timeUnit, quantifier] of timeUnits.map<[TimeUnit, number | undefined]>((timeUnit, index) => [
		timeUnit,
		quantifiers[index],
	])) {
		if (quantifier === undefined) {
			throw new Error(`Failed to get quantifier for time unit '${timeUnit}' and locale '${interaction.locale}'.`);
		}

		timeUnitQuantifierTuples.push([timeUnit, quantifier]);
	}
	timeUnitQuantifierTuples.sort(([previous], [next]) => constants.time[next] - constants.time[previous]);

	const timeExpressions: string[] = [];
	let total = 0;
	for (const [timeUnit, quantifier] of timeUnitQuantifierTuples) {
		const strings = {
			unit: client.pluralise(`units.${timeUnit}.word`, interaction.locale, { quantity: quantifier }),
		};

		timeExpressions.push(strings.unit);

		total += quantifier * constants.time[timeUnit];
	}
	const correctedExpression = timeExpressions.join(", ");

	return [correctedExpression, total];
}

export { parseTimeExpression };
