import type { Client } from "rost/client";
import { InteractionCollector } from "rost/collectors";

interface View {
	embed: Discord.Camelize<Discord.DiscordEmbed>;
	components?: Discord.MessageComponents;
}
type PageAction = "previous" | "next";

abstract class PaginatedView<T> {
	readonly client: Client;

	readonly #pageButtons: InteractionCollector<[action: PageAction]>;
	readonly #anchor: Rost.Interaction;
	readonly #pages: T[][];
	readonly #showable: boolean;
	#index: number;

	get #isOnFirstPage(): boolean {
		return this.#index === 0;
	}

	get #isOnLastPage(): boolean {
		return this.#index === Math.max(this.#pages.length - 1, 0);
	}

	get #hasSinglePage(): boolean {
		return this.#pages.length === 1;
	}

	get #currentPage(): T[] {
		return this.#pages.at(this.#index)!;
	}

	get #view(): View {
		const { embed, components } = this.build(this.#anchor, this.#currentPage, this.#index);

		let title: string | undefined;
		if (this.#hasSinglePage) {
			title = embed.title;
		} else {
			const strings = constants.contexts.page({
				localise: this.client.localise,
				locale: this.#anchor.locale,
			});

			title = `${embed.title} ~ ${strings.page} ${this.#index + 1}/${this.#pages.length}`;
		}

		if (!this.#isOnLastPage) {
			const strings = constants.contexts.continuedOnNextPage({
				localise: this.client.localise,
				locale: this.#anchor.locale,
			});

			return { embed: { ...embed, title, footer: { text: strings.continuedOnNextPage } }, components };
		}

		return { embed: { ...embed, title }, components };
	}

	get #paginationControls(): Discord.MessageComponents {
		const buttons: Discord.ButtonComponent[] = [
			{
				type: Discord.MessageComponentTypes.Button,
				customId: this.#pageButtons.encodeId(["previous"]),
				disabled: this.#isOnFirstPage,
				style: Discord.ButtonStyles.Secondary,
				label: constants.emojis.interactions.menu.controls.back,
			},
			{
				type: Discord.MessageComponentTypes.Button,
				customId: this.#pageButtons.encodeId(["next"]),
				disabled: this.#isOnLastPage,
				style: Discord.ButtonStyles.Secondary,
				label: constants.emojis.interactions.menu.controls.forward,
			},
		];

		if (this.#showable && !this.#anchor.parameters.show) {
			const showButton = this.client.services.global("interactionRepetition").getShowButton(this.#anchor);

			return [
				{
					type: Discord.MessageComponentTypes.ActionRow,
					components: [...buttons, showButton] as [Discord.ButtonComponent],
				},
			];
		}

		return [
			{
				type: Discord.MessageComponentTypes.ActionRow,
				components: buttons as [Discord.ButtonComponent],
			},
		];
	}

	constructor(
		client: Client,
		{
			interaction,
			elements,
			showable,
			entriesPerPage,
		}: { interaction: Rost.Interaction; elements: T[]; showable?: boolean; entriesPerPage?: number },
	) {
		this.client = client;
		this.#anchor = interaction;

		this.#pages = elements.toChunked(entriesPerPage ?? constants.RESULTS_PER_PAGE);
		this.#showable = showable ?? false;
		this.#index = 0;

		this.#pageButtons = new InteractionCollector<[action: PageAction]>(client, {
			only: interaction.parameters.show ? [interaction.user.id] : undefined,
		});
	}

	abstract build(interaction: Rost.Interaction, page: T[], index: number): View;

	async #display(): Promise<void> {
		await this.client.reply(this.#anchor, {
			embeds: [this.#view.embed],
			components: this.#paginationControls,
		});
	}

	async refresh(): Promise<void> {
		const view = this.#view;

		await this.client.editReply(this.#anchor, {
			embeds: [view.embed],
			components: [...(view.components ?? []), ...this.#paginationControls],
		});
	}

	navigateToPreviousPage(): void {
		if (this.#isOnFirstPage) {
			return;
		}

		this.#index -= 1;
	}

	navigateToNextPage(): void {
		if (this.#isOnLastPage) {
			return;
		}

		this.#index += 1;
	}

	async open(): Promise<void> {
		this.#pageButtons.onInteraction(async (buttonPress) => {
			this.client.acknowledge(buttonPress).ignore();

			switch (buttonPress.metadata[1]) {
				case "previous": {
					this.navigateToPreviousPage();
					break;
				}
				case "next": {
					this.navigateToNextPage();
					break;
				}
			}

			await this.refresh();
		});

		this.#pageButtons.onDone(this.close.bind(this));

		await this.client.registerInteractionCollector(this.#pageButtons);

		await this.#display();
	}

	async close(): Promise<void> {
		this.#pageButtons.close();
	}
}

export { PaginatedView };
export type { View };
