import type { EventLogger } from "rost/stores/journalling/loggers";

const logger: EventLogger<"guildBanRemove"> = (client, [user, _], { guildLocale }) => {
	const strings = constants.contexts.guildBanRemove({ localise: client.localise, locale: guildLocale });
	return {
		embeds: [
			{
				title: `${constants.emojis.events.user.unbanned} ${strings.title}`,
				color: constants.colours.success,
				description: strings.description({ user: client.diagnostics.user(user) }),
			},
		],
	};
};

export default logger;
