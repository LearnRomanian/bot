import constants from "../../../../constants/constants";
import diagnostics from "../../../../diagnostics";
import { GuildEvents, MessageGenerators } from "../generator";

export default {
	title: `${constants.symbols.events.entryRequest.accepted} Entry request accepted`,
	message: (client, user, by) => {
		const byUser = client.entities.users.get(by.id);
		if (byUser === undefined) {
			return;
		}

		return `${diagnostics.display.user(user)}'s entry request has been accepted by ${diagnostics.display.user(byUser)}`;
	},
	filter: (_, originGuildId, __, by) => originGuildId === by.guildId,
	color: constants.colors.lightGreen,
} satisfies MessageGenerators<GuildEvents>["entryRequestAccept"];
