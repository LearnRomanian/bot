import { mention } from "rost:constants/formatting";
import type { EventLogger } from "rost/stores/journalling/loggers";

const logger: EventLogger<"slowmodeDisable"> = (client, [user, channel], { guildLocale }) => {
	const strings = constants.contexts.slowmodeDisable({ localise: client.localise, locale: guildLocale });
	return {
		embeds: [
			{
				title: `${constants.emojis.events.slowmode.disabled} ${strings.title}`,
				color: constants.colours.warning,
				description: strings.description({
					moderator: client.diagnostics.user(user),
					channel: mention(channel.id, { type: "channel" }),
				}),
			},
		],
	};
};

export default logger;
