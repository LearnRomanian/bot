import type { Client } from "rost/client";
import { InteractionCollector } from "rost/collectors";
import { GlobalService } from "rost/services/service";
import { InteractionStore } from "rost/stores/interactions";

class InteractionRepetitionService extends GlobalService {
	readonly #commandInteractions: InteractionCollector;
	readonly #showInChatButtons: InteractionCollector<[interactionId: string]>;

	constructor(client: Client) {
		super(client, { identifier: "InteractionRepetitionService" });

		this.#commandInteractions = new InteractionCollector(client, {
			type: Discord.InteractionTypes.ApplicationCommand,
			anyCustomId: true,
			isPermanent: true,
		});
		this.#showInChatButtons = new InteractionCollector<[interactionId: string]>(client, {
			customId: constants.components.showInChat,
			isPermanent: true,
		});
	}

	async start(): Promise<void> {
		this.#commandInteractions.onInteraction(this.#handleCommandInteraction.bind(this));
		this.#showInChatButtons.onInteraction(this.#handleShowInChat.bind(this));

		await this.client.registerInteractionCollector(this.#commandInteractions);
		await this.client.registerInteractionCollector(this.#showInChatButtons);
	}

	async stop(): Promise<void> {
		await this.#commandInteractions.close();
		await this.#showInChatButtons.close();
	}

	#handleCommandInteraction(interaction: Rost.Interaction): void {
		if (!this.client.isShowable(interaction)) {
			return;
		}

		this.client.interactions.registerInteraction(interaction);
	}

	async #handleShowInChat(buttonPress: Rost.Interaction<[interactionId: string]>): Promise<void> {
		await this.client.postponeReply(buttonPress);

		const confirmButton = new InteractionCollector(this.client, {
			only: [buttonPress.user.id],
			dependsOn: this.#showInChatButtons,
			isSingle: true,
		});
		const cancelButton = new InteractionCollector(this.client, {
			only: [buttonPress.user.id],
			dependsOn: this.#showInChatButtons,
			isSingle: true,
		});

		confirmButton.onInteraction(async (confirmButtonPress) => {
			this.client.deleteReply(buttonPress).ignore();

			const originalInteraction = this.client.interactions.unregisterInteraction(BigInt(buttonPress.metadata[1]));
			if (originalInteraction === undefined) {
				return;
			}

			this.client.deleteReply(originalInteraction).ignore();

			const interactionSpoofed = InteractionStore.spoofInteraction(originalInteraction, {
				using: confirmButtonPress,
				parameters: { "@repeat": true, show: true },
			});

			await this.client.interactions.handleInteraction(interactionSpoofed);
		});

		cancelButton.onInteraction((_) => this.client.deleteReply(buttonPress).ignore());

		await this.client.registerInteractionCollector(confirmButton);
		await this.client.registerInteractionCollector(cancelButton);

		const strings = constants.contexts.sureToShow({
			localise: this.client.localise,
			locale: buttonPress.locale,
		});
		this.client
			.pushedBack(buttonPress, {
				embeds: [
					{
						title: strings.title,
						description: strings.description,
					},
				],
				components: [
					{
						type: Discord.MessageComponentTypes.ActionRow,
						components: [
							{
								type: Discord.MessageComponentTypes.Button,
								customId: confirmButton.customId,
								label: strings.yes,
								style: Discord.ButtonStyles.Success,
							},
							{
								type: Discord.MessageComponentTypes.Button,
								customId: cancelButton.customId,
								label: strings.no,
								style: Discord.ButtonStyles.Danger,
							},
						],
					},
				],
			})
			.ignore();
	}

	getShowButton(interaction: Rost.Interaction): Discord.ButtonComponent {
		const strings = constants.contexts.show({
			localise: this.client.localise,
			locale: interaction.locale,
		});
		return {
			type: Discord.MessageComponentTypes.Button,
			style: Discord.ButtonStyles.Primary,
			label: strings.show,
			emoji: { name: constants.emojis.showInChat },
			customId: this.#showInChatButtons.encodeId([interaction.id.toString()]),
		};
	}
}

export { InteractionRepetitionService };
