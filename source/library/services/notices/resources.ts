import { code } from "rost:constants/formatting";
import type { Client } from "rost/client";
import { type HashableMessageContents, NoticeService } from "rost/services/notices/service";

class ResourceNoticeService extends NoticeService<{ type: "resources" }> {
	constructor(client: Client, { guildId }: { guildId: bigint }) {
		super(client, { identifier: "ResourceNoticeService", guildId }, { type: "resources" });
	}

	generateNotice(): HashableMessageContents | undefined {
		const resourceConfiguration = this.guildDocument.feature("resources");
		if (resourceConfiguration === undefined) {
			return;
		}

		const strings = {
			...constants.contexts.resourceNotice({
				localise: this.client.localise,
				locale: this.guildLocale,
			}),
		};
		return {
			embeds: [
				{
					title: strings.title,
					description:
						`${strings.description.storedInRepository({ link: resourceConfiguration.url })}\n\n` +
						`${strings.description.easierToManage}\n\n` +
						`${strings.description.contributable.contributable}\n` +
						`1. ${strings.description.contributable.usingCommand({
							command: code(this.client.localiseCommand("resource", this.guildLocale)),
						})}\n` +
						`2. ${strings.description.contributable.openingIssue}\n` +
						`3. ${strings.description.contributable.pullRequest}\n`,
					color: constants.colours.blue,
				},
			],
			components: [
				{
					type: Discord.MessageComponentTypes.ActionRow,
					components: [
						{
							type: Discord.MessageComponentTypes.Button,
							label: strings.redirect,
							style: Discord.ButtonStyles.Link,
							url: resourceConfiguration.url,
						},
					],
				},
			],
		};
	}
}

export { ResourceNoticeService };
