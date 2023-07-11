import constants from "../../../../constants";
import { MentionTypes, codeMultiline, mention } from "../../../../formatting";
import { diagnosticMentionUser } from "../../../utils";
import { ClientEvents, MessageGenerators } from "../generator";

export default {
	title: `${constants.symbols.events.message.deleted} Message deleted`,
	message: (client, _, payload, __) => {
		const message = client.cache.messages.latest.get(payload.id);
		if (message === undefined) {
			return;
		}

		const author = client.cache.users.get(message.authorId);
		if (author === undefined) {
			return;
		}

		return `${diagnosticMentionUser(author)} deleted their message in ${mention(
			message.channelId,
			MentionTypes.Channel,
		)}.

**CONTENT**
${codeMultiline(message.content)}`;
	},
	filter: (client, originGuildId, _, payload, __) => {
		const message = client.cache.messages.latest.get(payload.id);
		if (message === undefined) {
			return false;
		}

		const author = client.cache.users.get(message.authorId);
		if (author === undefined) {
			return false;
		}

		return originGuildId === message.guildId && !author.toggles.bot;
	},
	color: constants.colors.red,
} satisfies MessageGenerators<ClientEvents>["messageDelete"];
