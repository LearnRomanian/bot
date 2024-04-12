import { Locale } from "logos:constants/languages/localisation";
import { trim } from "logos:core/formatting";
import { Client } from "logos/client";
import { InteractionCollector } from "logos/collectors";
import { PaginatedView, View } from "logos/commands/components/paginated-views/paginated-view";
import { SongListing } from "logos/services/music";

class RemoveSongListingView extends PaginatedView<SongListing> {
	readonly #_selectMenuSelection: InteractionCollector;

	get onInteraction(): InteractionCollector["onInteraction"] {
		return this.#_selectMenuSelection.onInteraction.bind(this);
	}

	constructor(client: Client, { interaction, listings }: { interaction: Logos.Interaction; listings: SongListing[] }) {
		super(client, { interaction, elements: listings, showable: true });

		this.#_selectMenuSelection = new InteractionCollector(client, { only: [interaction.user.id] });
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
					customId: this.#_selectMenuSelection.customId,
					minValues: 1,
					maxValues: 1,
					options,
				},
			],
		};
	}

	build(page: SongListing[], pageIndex: number, { locale }: { locale: Locale }): View {
		if (page.length === 0) {
			const strings = {
				title: this.client.localise("music.options.remove.strings.queueEmpty.title", locale)(),
				description: this.client.localise("music.options.remove.strings.queueEmpty.description", locale)(),
			};

			return { embed: { title: strings.title, description: strings.description, color: constants.colours.notice } };
		}

		const selectMenu = this.#buildSelectMenu(page, pageIndex);

		const strings = {
			title: this.client.localise("music.options.remove.strings.selectSong.title", locale)(),
			description: this.client.localise("music.options.remove.strings.selectSong.description", locale)(),
		};

		return {
			embed: { title: strings.title, description: strings.description, color: constants.colours.notice },
			components: [selectMenu],
		};
	}

	async open(): Promise<void> {
		await super.open();

		await this.client.registerInteractionCollector(this.#_selectMenuSelection);
	}

	async close(): Promise<void> {
		await super.close();

		this.#_selectMenuSelection.close();
	}
}

export { RemoveSongListingView };
