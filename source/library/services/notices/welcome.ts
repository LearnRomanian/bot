import { mention } from "rost:constants/formatting";
import type { Client } from "rost/client";
import { type HashableMessageContents, NoticeService } from "rost/services/notices/service";

class WelcomeNoticeService extends NoticeService<{ type: "welcome" }> {
	constructor(client: Client, { guildId }: { guildId: bigint }) {
		super(client, { identifier: "WelcomeNoticeService", guildId }, { type: "welcome" });
	}

	generateNotice(): HashableMessageContents | undefined {
		const strings = constants.contexts.welcomeNotice({ localise: this.client.localise, locale: this.guildLocale });
		return {
			embeds: [
				{
					title: strings.title({ server_name: this.guild.name }),
					description: strings.description.toEnter({
						information_channel_mention: mention(this.configuration.ruleChannelId, { type: "channel" }),
					}),
					image: { url: constants.gifs.followRules },
					color: constants.colours.blue,
				},
			],
			components: [
				{
					type: Discord.MessageComponentTypes.ActionRow,
					components: [
						{
							type: Discord.MessageComponentTypes.Button,
							style: Discord.ButtonStyles.Secondary,
							label: strings.description.acceptedRules,
							customId: constants.components.acceptedRules,
							emoji: { name: constants.emojis.services.notices.welcome.understood },
						},
					],
				},
			],
		};
	}
}

export { WelcomeNoticeService };
