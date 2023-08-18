import constants from "../../../../constants/constants";
import { MentionTypes, codeMultiline, mention } from "../../../../formatting";
import diagnostics from "../../../diagnostics";
import { ClientEvents, MessageGenerators } from "../generator";

export default {
	title: `${constants.symbols.events.message.deleted} Message deleted`,
	message: (client, payload, _) => {
		const message = client.cache.messages.latest.get(payload.id);
		if (message === undefined) {
			return;
		}

		const author = client.cache.users.get(message.author.id);
		if (author === undefined) {
			return;
		}

		return `${diagnostics.display.user(author)} deleted their message in ${mention(
			message.channelId,
			MentionTypes.Channel,
		)}.

**CONTENT**
${codeMultiline(message.content)}`;
	},
	filter: (client, originGuildId, payload, __) => {
		const message = client.cache.messages.latest.get(payload.id);
		if (message === undefined) {
			return false;
		}

		const author = client.cache.users.get(message.author.id);
		if (author === undefined) {
			return false;
		}

		return originGuildId === message.guildId && !author.toggles?.has("bot");
	},
	color: constants.colors.red,
} satisfies MessageGenerators<ClientEvents>["messageDelete"];
