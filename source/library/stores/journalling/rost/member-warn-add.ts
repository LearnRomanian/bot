import type { EventLogger } from "rost/stores/journalling/loggers";

const logger: EventLogger<"memberWarnAdd"> = (client, [member, warning, author], { guildLocale }) => {
	const strings = constants.contexts.memberWarnAdd({ localise: client.localise, locale: guildLocale });
	return {
		embeds: [
			{
				title: `${constants.emojis.events.warned} ${strings.title}`,
				color: constants.colours.warning,
				description: strings.description({
					user: client.diagnostics.member(member),
					moderator: client.diagnostics.user(author),
				}),
				fields: [
					{
						name: strings.fields.reason,
						value: warning.reason,
					},
				],
			},
		],
	};
};

export default logger;
