import { Client } from "logos/client";
import { handleRequestPlayback } from "logos/commands/music/commands/play/query";
import { SongListing } from "logos/commands/music/data/types";

async function handleRequestFilePlayback(
	client: Client,
	interaction: Logos.Interaction<any, { url: string }>,
): Promise<void> {
	const locale = interaction.locale;

	await client.postponeReply(interaction);
	await client.deleteReply(interaction);

	const strings = {
		externalFile: client.localise("music.options.play.strings.externalFile", locale)(),
	};

	const listing: SongListing = {
		requestedBy: interaction.user.id,
		managerIds: [],
		content: {
			type: "file",
			title: strings.externalFile,
			url: interaction.parameters.url,
		},
	};

	await handleRequestPlayback(client, interaction, listing);
}

export { handleRequestFilePlayback };
