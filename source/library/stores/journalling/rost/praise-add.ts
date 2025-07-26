import type { EventLogger } from "rost/stores/journalling/loggers";

const logger: EventLogger<"praiseAdd"> = (client, [member, praise, author], { guildLocale }) => {
	const strings = constants.contexts.praiseAdd({ localise: client.localise, locale: guildLocale });
	return {
		embeds: [
			{
				title: `${constants.emojis.events.praised} ${strings.title}`,
				color: constants.colours.success,
				description: strings.description({
					user: client.diagnostics.member(member),
					moderator: client.diagnostics.user(author),
				}),
				fields:
					praise.comment !== undefined
						? [
								{
									name: strings.fields.comment,
									value: praise.comment,
								},
							]
						: undefined,
			},
		],
	};
};

export default logger;
