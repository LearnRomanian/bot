import { codeMultiline, mention } from "rost:constants/formatting";
import { isDefined } from "rost:core/utilities";
import type { EventLogger } from "rost/stores/journalling/loggers";

const logger: EventLogger<"messageDelete"> = (client, [payload, _], { guildLocale }) => {
	const message = client.entities.messages.latest.get(payload.id);
	if (message === undefined) {
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
				fields:
					message.content.length > 0
						? [
								{
									name: strings.fields.content,
									value: codeMultiline(message.content),
								},
							]
						: undefined,
			},
		],
		files: message.attachments
			?.map((attachment) => client.entities.attachments.get(attachment.id))
			.filter(isDefined),
	};
};

export default logger;
