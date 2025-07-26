import type { Client } from "rost/client";
import type { Report } from "rost/models/report";
import { User } from "rost/models/user";
import { PromptService } from "rost/services/prompts/service";

class ReportPromptService extends PromptService<{
	type: "reports";
	model: Report;
	metadata: [partialId: string, isResolve: string];
}> {
	constructor(client: Client, { guildId }: { guildId: bigint }) {
		super(client, { identifier: "ReportPromptService", guildId }, { type: "reports", deleteMode: "delete" });
	}

	getAllDocuments(): Map<string, Report> {
		const reports = new Map<string, Report>();

		for (const [partialId, reportDocument] of this.client.documents.reports) {
			if (reportDocument.guildId !== this.guildIdString) {
				continue;
			}

			reports.set(partialId, reportDocument);
		}

		return reports;
	}

	async getUserDocument(reportDocument: Report): Promise<User> {
		return User.getOrCreate(this.client, { userId: reportDocument.authorId });
	}

	getPromptContent(user: Rost.User, reportDocument: Report): Discord.CreateMessageOptions | undefined {
		const strings = constants.contexts.reportPrompt({
			localise: this.client.localise,
			locale: this.guildLocale,
		});
		return {
			embeds: [
				{
					color: reportDocument.isResolved ? constants.colours.green : constants.colours.peach,
					thumbnail: (() => {
						const iconURL = Discord.avatarUrl(user.id, user.discriminator, {
							avatar: user.avatar,
							size: 128,
							format: "webp",
						});
						if (iconURL === undefined) {
							return;
						}

						return { url: iconURL };
					})(),
					fields: [
						{
							name: this.client.diagnostics.user(user),
							value: reportDocument.formData.reason,
							inline: false,
						},
						{
							name: strings.report.users,
							value: reportDocument.formData.users,
							inline: true,
						},
						{
							name: strings.report.link,
							value: reportDocument.formData.messageLink ?? `*${strings.report.noLinkProvided}*`,
							inline: true,
						},
					],
					footer: {
						text: this.guild.name,
						iconUrl: PromptService.encodeMetadataInGuildIcon({
							guild: this.guild,
							partialId: reportDocument.partialId,
						}),
					},
				},
			],
			components: [
				{
					type: Discord.MessageComponentTypes.ActionRow,
					components: reportDocument.isResolved
						? [
								{
									type: Discord.MessageComponentTypes.Button,
									style: Discord.ButtonStyles.Success,
									label: strings.markUnresolved,
									customId: this.magicButton.encodeId([reportDocument.partialId, `${false}`]),
								},

								{
									type: Discord.MessageComponentTypes.Button,
									style: Discord.ButtonStyles.Danger,
									label: strings.close,
									customId: this.removeButton.encodeId([reportDocument.partialId]),
								},
							]
						: [
								{
									type: Discord.MessageComponentTypes.Button,
									style: Discord.ButtonStyles.Primary,
									label: strings.markResolved,
									customId: this.magicButton.encodeId([reportDocument.partialId, `${true}`]),
								},
							],
				},
			],
		};
	}

	getNoPromptsMessageContent(): Discord.CreateMessageOptions {
		const strings = constants.contexts.noReports({
			localise: this.client.localise,
			locale: this.guildLocale,
		});

		return {
			embeds: [
				{
					title: strings.title,
					description: strings.description,
					color: constants.colours.success,
					footer: {
						text: this.guild.name,
						iconUrl: PromptService.encodeMetadataInGuildIcon({
							guild: this.guild,
							partialId: constants.components.noPrompts,
						}),
					},
				},
			],
		};
	}

	async handlePromptInteraction(
		interaction: Rost.Interaction<[partialId: string, isResolve: string]>,
	): Promise<Report | null | undefined> {
		const reportDocument = this.documents.get(interaction.metadata[1]);
		if (reportDocument === undefined) {
			return undefined;
		}

		const isResolved = interaction.metadata[2] === "true";
		if (isResolved && reportDocument.isResolved) {
			const strings = constants.contexts.alreadyMarkedResolved({
				localise: this.client.localise,
				locale: interaction.locale,
			});
			this.client
				.warning(interaction, {
					title: strings.title,
					description: strings.description,
				})
				.ignore();

			return;
		}

		if (!(isResolved || reportDocument.isResolved)) {
			const strings = constants.contexts.alreadyMarkedUnresolved({
				localise: this.client.localise,
				locale: interaction.locale,
			});
			this.client
				.warning(interaction, {
					title: strings.title,
					description: strings.description,
				})
				.ignore();

			return;
		}

		await reportDocument.update(this.client, () => {
			reportDocument.isResolved = isResolved;
		});

		return reportDocument;
	}
}

export { ReportPromptService };
