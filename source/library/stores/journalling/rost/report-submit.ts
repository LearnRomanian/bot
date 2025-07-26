import type { EventLogger } from "rost/stores/journalling/loggers";

const logger: EventLogger<"reportSubmit"> = (client, [author, report], { guildLocale }) => {
	const strings = constants.contexts.reportSubmit({ localise: client.localise, locale: guildLocale });
	return {
		embeds: [
			{
				title: `${constants.emojis.events.report} ${strings.title}`,
				color: constants.colours.failure,
				description: strings.description({ user: client.diagnostics.member(author) }),
				fields: [
					{
						name: strings.fields.reason,
						value: report.formData.reason,
					},
					{
						name: strings.fields.reportedUsers,
						value: report.formData.users,
					},
					...(report.formData.messageLink !== undefined
						? [
								{
									name: strings.fields.messageLink,
									value: report.formData.messageLink,
								},
							]
						: []),
				],
			},
		],
	};
};

export default logger;
