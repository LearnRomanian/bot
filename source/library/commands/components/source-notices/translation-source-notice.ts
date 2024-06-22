import { SourceNotice } from "logos/commands/components/source-notices/source-notice.ts";
import type { Client } from "logos/client.ts";
import type { Licence } from "logos:constants/licences.ts";

class TranslationSourceNotice extends SourceNotice {
	constructor(client: Client, { interaction, source }: { interaction: Logos.Interaction; source: Licence }) {
		const strings = constants.contexts.translationsSourcedFrom({
			localise: client.localise.bind(client),
			locale: interaction.displayLocale,
		});

		super(client, {
			interaction,
			sources: [strings.sourcedFrom({ source: `[${source.name}](${source.link})` })],
		});
	}
}

export { TranslationSourceNotice };
