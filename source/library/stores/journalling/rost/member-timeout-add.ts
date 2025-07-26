import { timestamp } from "rost:constants/formatting";
import type { EventLogger } from "rost/stores/journalling/loggers";

const logger: EventLogger<"memberTimeoutAdd"> = (client, [member, until, reason, author], { guildLocale }) => {
	const strings = constants.contexts.memberTimeoutAdd({
		localise: client.localise,
		locale: guildLocale,
	});
	return {
		embeds: [
			{
				title: `${constants.emojis.events.timeout.added} ${strings.title}`,
				color: constants.colours.warning,
				description: strings.description({
					user: client.diagnostics.member(member),
					moderator: client.diagnostics.user(author),
				}),
				fields: [
					{
						name: strings.fields.reason,
						value: reason,
					},
					{
						name: strings.fields.lastsUntil,
						value: timestamp(until, { format: "relative" }),
					},
				],
			},
		],
	};
};

export default logger;
