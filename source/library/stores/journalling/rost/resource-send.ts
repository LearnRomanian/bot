import type { EventLogger } from "rost/stores/journalling/loggers";

const logger: EventLogger<"resourceSend"> = (client, [author, resource], { guildLocale }) => {
	const strings = constants.contexts.resourceSend({ localise: client.localise, locale: guildLocale });
	return {
		embeds: [
			{
				title: `${constants.emojis.events.resource} ${strings.title}`,
				color: constants.colours.success,
				description: strings.description({ user: client.diagnostics.member(author) }),
				fields: [
					{
						name: strings.fields.resource,
						value: resource.formData.resource,
					},
				],
			},
		],
	};
};

export default logger;
