import { mention } from "rost:constants/formatting";
import type { EventLogger } from "rost/stores/journalling/loggers";

const logger: EventLogger<"purgeBegin"> = (client, [member, channel, messageCount, author], { guildLocale }) => {
	const strings = constants.contexts.purgeBegin({ localise: client.localise, locale: guildLocale });
	return {
		embeds: [
			{
				title: `${constants.emojis.events.purging.begin} ${strings.title}`,
				color: constants.colours.warning,
				description: strings.description({
					moderator: client.diagnostics.member(member),
					messages: client.pluralise("events.purgeBegin.description.messages", guildLocale, {
						quantity: messageCount,
					}),
					channel: mention(channel.id, { type: "channel" }),
				}),
				fields:
					author !== undefined
						? [
								{
									name: strings.fields.author,
									value: client.diagnostics.user(author),
								},
							]
						: undefined,
			},
		],
	};
};

export default logger;
