import type { EventLogger } from "rost/stores/journalling/loggers";

const logger: EventLogger<"inquiryOpen"> = (client, [member, _], { guildLocale }) => {
	const strings = constants.contexts.inquiryOpen({ localise: client.localise, locale: guildLocale });
	return {
		embeds: [
			{
				title: `${constants.emojis.events.ticket} ${strings.title}`,
				color: constants.colours.notice,
				description: strings.description({ moderator: client.diagnostics.member(member) }),
			},
		],
	};
};

export default logger;
