export default function pluralise(_: string, __: Record<string, string> = {}): string | undefined {
	throw new Error("This locale does not have support for pluralisation.");
}
