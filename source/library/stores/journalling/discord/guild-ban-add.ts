import type { EventLogger } from "rost/stores/journalling/loggers";

const logger: EventLogger<"guildBanAdd"> = (client, [user, _], { guildLocale }) => {
	const strings = constants.contexts.guildBanAdd({ localise: client.localise, locale: guildLocale });
	return {
		embeds: [
			{
				title: `${constants.emojis.events.user.banned} ${strings.title}`,
				color: constants.colours.failure,
				description: strings.description({ user: client.diagnostics.user(user) }),
			},
		],
	};
};

export default logger;
