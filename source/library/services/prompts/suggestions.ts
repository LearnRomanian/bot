import type { Client } from "rost/client";
import type { Suggestion } from "rost/models/suggestion";
import { User } from "rost/models/user";
import { PromptService } from "rost/services/prompts/service";

class SuggestionPromptService extends PromptService<{
	type: "suggestions";
	model: Suggestion;
	metadata: [partialId: string, isResolve: string];
}> {
	constructor(client: Client, { guildId }: { guildId: bigint }) {
		super(
			client,
			{ identifier: "SuggestionPromptService", guildId },
			{ type: "suggestions", deleteMode: "delete" },
		);
	}

	getAllDocuments(): Map<string, Suggestion> {
		const suggestions = new Map<string, Suggestion>();

		for (const [partialId, suggestionDocument] of this.client.documents.suggestions) {
			if (suggestionDocument.guildId !== this.guildIdString) {
				continue;
			}

			suggestions.set(partialId, suggestionDocument);
		}

		return suggestions;
	}

	async getUserDocument(suggestionDocument: Suggestion): Promise<User> {
		return User.getOrCreate(this.client, { userId: suggestionDocument.authorId });
	}

	getPromptContent(user: Rost.User, suggestionDocument: Suggestion): Discord.CreateMessageOptions | undefined {
		const strings = constants.contexts.promptControls({
			localise: this.client.localise,
			locale: this.guildLocale,
		});
		return {
			embeds: [
				{
					description: `*${suggestionDocument.formData.suggestion}*`,
					color: suggestionDocument.isResolved ? constants.colours.green : constants.colours.dullYellow,
					footer: {
						text: this.client.diagnostics.user(user),
						iconUrl: PromptService.encodeMetadataInUserAvatar({
							user,
							partialId: suggestionDocument.partialId,
						}),
					},
				},
			],
			components: [
				{
					type: Discord.MessageComponentTypes.ActionRow,
					components: suggestionDocument.isResolved
						? [
								{
									type: Discord.MessageComponentTypes.Button,
									style: Discord.ButtonStyles.Success,
									label: strings.markUnresolved,
									customId: this.magicButton.encodeId([suggestionDocument.partialId, `${false}`]),
								},
								{
									type: Discord.MessageComponentTypes.Button,
									style: Discord.ButtonStyles.Danger,
									label: strings.remove,
									customId: this.removeButton.encodeId([suggestionDocument.partialId]),
								},
							]
						: [
								{
									type: Discord.MessageComponentTypes.Button,
									style: Discord.ButtonStyles.Primary,
									label: strings.markResolved,
									customId: this.magicButton.encodeId([suggestionDocument.partialId, `${true}`]),
								},
							],
				},
			],
		};
	}

	getNoPromptsMessageContent(): Discord.CreateMessageOptions {
		const strings = constants.contexts.noSuggestions({
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
	): Promise<Suggestion | null | undefined> {
		const suggestionDocument = this.documents.get(interaction.metadata[1]);
		if (suggestionDocument === undefined) {
			return undefined;
		}

		const isResolved = interaction.metadata[2] === "true";
		if (isResolved && suggestionDocument.isResolved) {
			const strings = constants.contexts.alreadyMarkedResolved({
				localise: this.client.localise,
				locale: interaction.locale,
			});
			this.client.warning(interaction, { title: strings.title, description: strings.description }).ignore();

			return;
		}

		if (!(isResolved || suggestionDocument.isResolved)) {
			const strings = constants.contexts.alreadyMarkedUnresolved({
				localise: this.client.localise,
				locale: interaction.locale,
			});
			this.client.warning(interaction, { title: strings.title, description: strings.description }).ignore();

			return;
		}

		await suggestionDocument.update(this.client, () => {
			suggestionDocument.isResolved = isResolved;
		});

		return suggestionDocument;
	}
}

export { SuggestionPromptService };
