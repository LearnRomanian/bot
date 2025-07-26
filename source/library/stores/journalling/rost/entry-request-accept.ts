import type { EventLogger } from "rost/stores/journalling/loggers";

const logger: EventLogger<"entryRequestAccept"> = (client, [user, author], { guildLocale }) => {
	const strings = constants.contexts.entryRequestAccept({
		localise: client.localise,
		locale: guildLocale,
	});
	return {
		embeds: [
			{
				title: `${constants.emojis.events.entryRequest.accepted} ${strings.title}`,
				color: constants.colours.success,
				description: strings.description({
					user: client.diagnostics.user(user),
					moderator: client.diagnostics.member(author),
				}),
			},
		],
	};
};

export default logger;
