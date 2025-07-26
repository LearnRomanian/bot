import type { EventLogger } from "rost/stores/journalling/loggers";

const logger: EventLogger<"guildMemberRemove"> = (client, [user, _], { guildLocale }) => {
	const strings = constants.contexts.guildMemberRemove({
		localise: client.localise,
		locale: guildLocale,
	});
	return {
		embeds: [
			{
				title: `${constants.emojis.events.user.left} ${strings.title}`,
				color: constants.colours.warning,
				description: strings.description({ user: client.diagnostics.user(user) }),
			},
		],
	};
};

export default logger;
