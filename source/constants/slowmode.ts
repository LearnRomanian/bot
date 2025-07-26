import time from "rost:constants/time";

const levels = ["lowest", "low", "medium", "high", "highest", "emergency", "lockdown", "beyond"] as const;
type SlowmodeLevel = (typeof levels)[number];

const slowmodeDelayByLevel = Object.freeze({
	lowest: time.second * 5,
	low: time.second * 10,
	medium: time.second * 30,
	high: time.minute,
	highest: time.minute * 5,
	emergency: time.minute * 20,
	lockdown: time.hour,
	beyond: time.day,
} as const satisfies Record<SlowmodeLevel, number>);

function isValidSlowmodeLevel(level: string): level is SlowmodeLevel {
	return (levels as readonly string[]).includes(level);
}

/**
 * @remarks
 * The returned value is in seconds.
 */
function getSlowmodeDelayByLevel(level: SlowmodeLevel): number {
	return Math.floor(slowmodeDelayByLevel[level] / 1000);
}

function getSlowmodeLevelByDelay(delay: number): SlowmodeLevel | undefined {
	const delayMilliseconds = delay * 1000;

	for (const [level, delay] of Object.entries(slowmodeDelayByLevel) as [SlowmodeLevel, number][]) {
		if (delayMilliseconds !== delay) {
			continue;
		}

		return level;
	}

	return undefined;
}

export default Object.freeze({ levels } as const);
export { isValidSlowmodeLevel, getSlowmodeDelayByLevel, getSlowmodeLevelByDelay };
export type { SlowmodeLevel };
