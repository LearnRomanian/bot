import { trim } from "rost:constants/formatting";
import type { Client } from "rost/client";
import { InteractionCollector } from "rost/collectors";
import { PaginatedView, type View } from "rost/commands/components/paginated-views/paginated-view";
import type { SongListing } from "rost/services/music";

class RemoveSongListingView extends PaginatedView<SongListing> {
	readonly #selectMenuSelection: InteractionCollector;

	constructor(client: Client, { interaction, listings }: { interaction: Rost.Interaction; listings: SongListing[] }) {
		super(client, { interaction, elements: listings, showable: true });

		this.#selectMenuSelection = new InteractionCollector(client, { only: [interaction.user.id] });
	}

	#buildSelectMenu(page: SongListing[], pageIndex: number): Discord.ActionRow {
		const options = page.map<Discord.SelectOption>((listing, index) => ({
			emoji: { name: listing.queueable.emoji },
			label: trim(listing.queueable.title, 100),
			value: (pageIndex * constants.RESULTS_PER_PAGE + index).toString(),
		}));

		return {
			type: Discord.MessageComponentTypes.ActionRow,
			components: [
				{
					type: Discord.MessageComponentTypes.SelectMenu,
					customId: this.#selectMenuSelection.customId,
					minValues: 1,
					maxValues: 1,
					options,
				},
			],
		};
	}

	build(interaction: Rost.Interaction, page: SongListing[], pageIndex: number): View {
		if (page.length === 0) {
			const strings = constants.contexts.queueEmpty({
				localise: this.client.localise,
				locale: interaction.locale,
			});

			return {
				embed: { title: strings.title, description: strings.description, color: constants.colours.notice },
			};
		}

		const selectMenu = this.#buildSelectMenu(page, pageIndex);

		const strings = constants.contexts.selectSongToRemove({
			localise: this.client.localise,
			locale: interaction.locale,
		});

		return {
			embed: { title: strings.title, description: strings.description, color: constants.colours.notice },
			components: [selectMenu],
		};
	}

	onRemove(callback: Parameters<InteractionCollector["onInteraction"]>[0]): void {
		this.#selectMenuSelection.onInteraction(callback);
	}

	async open(): Promise<void> {
		await super.open();

		await this.client.registerInteractionCollector(this.#selectMenuSelection);
	}

	async close(): Promise<void> {
		await super.close();

		this.#selectMenuSelection.close();
	}
}

export { RemoveSongListingView };
