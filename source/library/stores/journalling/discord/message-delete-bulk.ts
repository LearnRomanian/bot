import { mention } from "rost:constants/formatting";
import { isDefined } from "rost:core/utilities";
import { JournallingStore } from "rost/stores/journalling";
import type { EventLogger } from "rost/stores/journalling/loggers";

const logger: EventLogger<"messageDeleteBulk"> = (client, [payload], { guildLocale }) => {
	const messages = payload.ids
		.toReversed()
		.map((messageId) => client.entities.messages.latest.get(messageId))
		.filter(isDefined);
	const messageLog = JournallingStore.generateMessageLog(client, { messages });

	const strings = constants.contexts.messageDeleteBulk({ localise: client.localise, locale: guildLocale });
	return {
		embeds: [
			{
				title: `${constants.emojis.events.message.deleted} ${strings.title}`,
				color: constants.colours.failure,
				description: strings.description({
					messages: client.pluralise("events.messageDeleteBulk.description.messages", guildLocale, {
						quantity: messages.length,
					}),
					channel: mention(payload.channelId, { type: "channel" }),
				}),
			},
		],
		files: [{ name: "log.txt", blob: new Blob([messageLog]) } as Discord.FileContent],
	};
};

export default logger;
