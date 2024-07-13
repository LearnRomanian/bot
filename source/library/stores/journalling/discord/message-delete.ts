import { codeMultiline, mention } from "logos:core/formatting";
import type { EventLogger } from "logos/stores/journalling/loggers";

const logger: EventLogger<"messageDelete"> = (client, [payload, _], { guildLocale }) => {
	const message = client.entities.messages.latest.get(payload.id);
	if (message === undefined) {
		return undefined;
	}

	if (message.content === undefined) {
		return undefined;
	}

	const strings = constants.contexts.messageDelete({ localise: client.localise, locale: guildLocale });
	return {
		embeds: [
			{
				title: `${constants.emojis.events.message.deleted} ${strings.title}`,
				color: constants.colours.failure,
				description: strings.description({
					user: client.diagnostics.user(message.author),
					channel: mention(message.channelId, { type: "channel" }),
				}),
				fields: [
					{
						name: strings.fields.content,
						value: codeMultiline(message.content),
					},
				],
			},
		],
	};
};

export default logger;
