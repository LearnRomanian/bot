import { code } from "rost:constants/formatting";
import type { Client } from "rost/client";
import { InteractionCollector } from "rost/collectors";
import { handleOpenRoleSelectionMenu } from "rost/commands/handlers/profile/roles";
import { type HashableMessageContents, NoticeService } from "rost/services/notices/service";

class RoleNoticeService extends NoticeService<{ type: "roles" }> {
	readonly #selectRolesButton: InteractionCollector;

	constructor(client: Client, { guildId }: { guildId: bigint }) {
		super(client, { identifier: "InformationNoticeService", guildId }, { type: "roles" });

		this.#selectRolesButton = new InteractionCollector(client, {
			guildId,
			customId: constants.components.selectRoles,
			isPermanent: true,
		});
	}

	async start(): Promise<void> {
		this.#selectRolesButton.onInteraction(async (buttonPress) => {
			await handleOpenRoleSelectionMenu(this.client, buttonPress);
		});

		await this.client.registerInteractionCollector(this.#selectRolesButton);

		await super.start();
	}

	async stop(): Promise<void> {
		await this.#selectRolesButton.close();

		await super.stop();
	}

	generateNotice(): HashableMessageContents | undefined {
		const strings = constants.contexts.howToSelectRoles({
			localise: this.client.localise,
			locale: this.guildLocale,
		});
		return {
			embeds: [
				{
					title: strings.title,
					description: `${strings.description.usingCommand({
						command: code(this.client.localiseCommand("profile.options.roles", this.guildLocale)),
					})} ${strings.description.runAnywhere}\n\n${strings.description.pressButton}`,
					color: constants.colours.blue,
				},
			],
			components: [
				{
					type: Discord.MessageComponentTypes.ActionRow,
					components: [
						{
							type: Discord.MessageComponentTypes.Button,
							label: strings.description.clickHere,
							style: Discord.ButtonStyles.Primary,
							customId: this.#selectRolesButton.customId,
						},
					],
				},
			],
		};
	}
}

export { RoleNoticeService };
