import { EventLogger } from "logos/stores/journalling/loggers";

const logger: EventLogger<"guildMemberRemove"> = async (client, [user, _], { guildLocale }) => {
	const strings = constants.contexts.guildMemberRemove({ localise: client.localise.bind(client), locale: guildLocale });
	return {
		embeds: [
			{
				title: `${constants.emojis.events.user.left} ${strings.title}`,
				colour: constants.colours.warning,
				description: strings.description({ user: client.diagnostics.user(user) }),
			},
		],
	};
};

export default logger;
