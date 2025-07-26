import { mention } from "rost:constants/formatting";
import type { EventLogger } from "rost/stores/journalling/loggers";

const logger: EventLogger<"slowmodeUpgrade"> = (
	client,
	[user, channel, previousLevel, currentLevel],
	{ guildLocale },
) => {
	const strings = constants.contexts.slowmodeUpgrade({ localise: client.localise, locale: guildLocale });
	return {
		embeds: [
			{
				title: `${constants.emojis.events.slowmode.upgraded} ${strings.title}`,
				color: constants.colours.warning,
				description: strings.description({
					moderator: client.diagnostics.user(user),
					channel: mention(channel.id, { type: "channel" }),
					level_before: previousLevel,
					level_after: currentLevel,
				}),
			},
		],
	};
};

export default logger;
