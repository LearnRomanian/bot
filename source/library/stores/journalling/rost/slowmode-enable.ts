import { mention } from "rost:constants/formatting";
import type { EventLogger } from "rost/stores/journalling/loggers";

const logger: EventLogger<"slowmodeEnable"> = (client, [user, channel, level], { guildLocale }) => {
	const strings = constants.contexts.slowmodeEnable({ localise: client.localise, locale: guildLocale });
	return {
		embeds: [
			{
				title: `${constants.emojis.events.slowmode.enabled} ${strings.title}`,
				color: constants.colours.warning,
				description: strings.description({
					moderator: client.diagnostics.user(user),
					channel: mention(channel.id, { type: "channel" }),
					level,
				}),
			},
		],
	};
};

export default logger;
