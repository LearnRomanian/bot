import constants from "../../../../constants/constants";
import { getLocaleByLanguage } from "../../../../constants/languages";
import { codeMultiline } from "../../../../formatting";
import { localise } from "../../../client";
import diagnostics from "../../../diagnostics";
import { getFeatureLanguage, getLocalisationLanguage } from "../../../interactions";
import { GuildEvents, MessageGenerators } from "../generator";

export default {
	title: `${constants.symbols.events.entryRequest.submitted} Entry request submitted`,
	message: async (client, user, entryRequest) => {
		const guildDocument = await client.database.adapters.guilds.getOrFetch(client, "id", entryRequest.guild);
		if (guildDocument === undefined) {
			return;
		}

		const guildLanguage = getLocalisationLanguage(guildDocument);
		const guildLocale = getLocaleByLanguage(guildLanguage);
		const featureLanguage = getFeatureLanguage(guildDocument);

		const strings = {
			reason: localise(client, "verification.fields.reason", guildLocale)({ language: featureLanguage }),
			aim: localise(client, "verification.fields.aim", guildLocale)(),
			whereFound: localise(client, "verification.fields.whereFound", guildLocale)(),
		};

		return `${diagnostics.display.user(user)} has submitted a request to join the server.

**${strings.reason}**
${codeMultiline(entryRequest.answers.reason)}
**${strings.aim}**
${codeMultiline(entryRequest.answers.aim)}
**${strings.whereFound}**
${codeMultiline(entryRequest.answers.whereFound)}
`;
	},
	filter: (client, originGuildId, _user, entryRequest) => {
		const guild = client.cache.guilds.get(BigInt(entryRequest.guild));
		if (guild === undefined) {
			return false;
		}

		return originGuildId === guild.id;
	},
	color: constants.colors.lightGreen,
} satisfies MessageGenerators<GuildEvents>["entryRequestSubmit"];
