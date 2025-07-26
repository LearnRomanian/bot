import type { Rule } from "rost:constants/rules";

interface WarningDocument {
	reason: string;
	rule?: Rule;
}

export type { WarningDocument };
