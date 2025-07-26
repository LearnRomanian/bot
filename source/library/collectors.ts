import { isSubcommand, isSubcommandGroup } from "rost:constants/interactions";
import type { DesiredProperties, DesiredPropertiesBehaviour } from "rost:constants/properties";
import type { PromiseOr } from "rost:core/utilities";
import { nanoid } from "nanoid";
import type { Client } from "rost/client";
import { Guild } from "rost/models/guild";

type Interaction = Discord.SetupDesiredProps<Discord.Interaction, DesiredProperties, DesiredPropertiesBehaviour>;

type CollectEvent<
	Event extends keyof Discord.EventHandlers<
		DesiredProperties,
		DesiredPropertiesBehaviour
	> = keyof Discord.EventHandlers<DesiredProperties, DesiredPropertiesBehaviour>,
> = (
	...args: Parameters<Discord.EventHandlers<DesiredProperties, DesiredPropertiesBehaviour>[Event]>
) => PromiseOr<void>;
type DoneEvent = () => void | Promise<void>;
class Collector<
	Event extends keyof Discord.EventHandlers<
		DesiredProperties,
		DesiredPropertiesBehaviour
	> = keyof Discord.EventHandlers<DesiredProperties, DesiredPropertiesBehaviour>,
> {
	readonly done: Promise<void>;
	readonly guildId?: bigint;

	readonly #isSingle: boolean;
	readonly #removeAfter?: number;
	readonly #dependsOn?: Collector;
	readonly #resolveDone: () => void;
	#onCollect?: CollectEvent<Event>;
	#onDone?: DoneEvent;
	#isClosed = false;

	get close(): DoneEvent {
		return this.dispatchDone.bind(this);
	}

	constructor({
		guildId,
		isSingle,
		removeAfter,
		dependsOn,
	}: {
		guildId?: bigint;
		isSingle?: boolean;
		removeAfter?: number;
		dependsOn?: Collector;
	} = {}) {
		const done = Promise.withResolvers<void>();
		this.done = done.promise;
		this.#resolveDone = done.resolve;

		this.guildId = guildId;

		this.#isSingle = isSingle ?? false;
		this.#removeAfter = removeAfter;
		this.#dependsOn = dependsOn;
	}

	initialise(): void {
		if (this.#removeAfter !== undefined) {
			setTimeout(() => this.close(), this.#removeAfter);
		}

		if (this.#dependsOn !== undefined) {
			this.#dependsOn.done.then(() => this.close());
		}
	}

	filter(..._: Parameters<Discord.EventHandlers<DesiredProperties, DesiredPropertiesBehaviour>[Event]>): boolean {
		return true;
	}

	async dispatchCollect(
		...args: Parameters<Discord.EventHandlers<DesiredProperties, DesiredPropertiesBehaviour>[Event]>
	): Promise<void> {
		if (this.#isClosed) {
			return;
		}

		await this.#onCollect?.(...args);

		if (this.#isSingle) {
			this.close();
		}
	}

	async dispatchDone(): Promise<void> {
		if (this.#isClosed) {
			return;
		}

		const dispatchDone = this.#onDone;

		this.#isClosed = true;
		this.#onCollect = undefined;
		this.#onDone = undefined;

		await dispatchDone?.();
		this.#resolveDone();
	}

	onCollect(callback: CollectEvent<Event>): void {
		this.#onCollect = callback;
	}

	onDone(callback: DoneEvent): void {
		if (this.#onDone !== undefined) {
			return;
		}

		this.#onDone = callback;
	}
}

type DiscordParameterType = string | number | boolean | undefined;

class InteractionCollector<
	Metadata extends string[] = [],
	Parameters extends Record<string, DiscordParameterType> = Record<string, string>,
> extends Collector<"interactionCreate"> {
	static readonly noneId = constants.components.none;

	static readonly #defaultParameters: Rost.InteractionParameters<Record<string, unknown>> = Object.freeze({
		"@repeat": false,
		show: false,
	});

	readonly anyType: boolean;
	readonly type: Discord.InteractionTypes;
	readonly anyCustomId: boolean;
	readonly customId: string;
	readonly only: Set<bigint>;

	readonly #client: Client;

	readonly #baseId: string;
	readonly #acceptAnyUser: boolean;

	constructor(
		client: Client,
		{
			guildId,
			anyType,
			type,
			anyCustomId,
			customId,
			only,
			dependsOn,
			isSingle,
			isPermanent,
		}: {
			guildId?: bigint;
			anyType?: boolean;
			type?: Discord.InteractionTypes;
			anyCustomId?: boolean;
			customId?: string;
			only?: bigint[];
			dependsOn?: Collector;
			isSingle?: boolean;
			isPermanent?: boolean;
		},
	) {
		super({
			guildId,
			isSingle,
			removeAfter: isPermanent ? undefined : constants.discord.INTERACTION_TOKEN_EXPIRY,
			dependsOn,
		});

		this.anyType = anyType ?? false;
		this.type = type ?? Discord.InteractionTypes.MessageComponent;
		this.anyCustomId = anyCustomId ?? false;
		this.customId = customId ?? nanoid();
		this.only = only !== undefined ? new Set(only) : new Set();

		this.#client = client;

		this.#baseId = InteractionCollector.decodeId(this.customId)[0];
		this.#acceptAnyUser = this.only.values.length === 0;
	}

	static getCommandName(interaction: Interaction): string {
		const commandName = interaction.data?.name;
		if (commandName === undefined) {
			throw new Error("Command did not have a name.");
		}

		const subCommandGroupOption = interaction.data?.options?.find((option) => isSubcommandGroup(option));

		let commandNameFull: string;
		if (subCommandGroupOption !== undefined) {
			const subCommandGroupName = subCommandGroupOption.name;
			const subCommandName = subCommandGroupOption.options?.find((option) => isSubcommand(option))?.name;
			if (subCommandName === undefined) {
				throw new Error("Sub-command did not have a name.");
			}

			commandNameFull = `${commandName} ${subCommandGroupName} ${subCommandName}`;
		} else {
			const subCommandName = interaction.data?.options?.find((option) => isSubcommand(option))?.name;
			if (subCommandName === undefined) {
				commandNameFull = commandName;
			} else {
				commandNameFull = `${commandName} ${subCommandName}`;
			}
		}

		return commandNameFull;
	}

	static encodeCustomId<Parts extends string[] = string[]>(parts: Parts): string {
		return parts.join(constants.special.interaction.divider);
	}

	filter(interaction: Interaction): boolean {
		if (!this.anyType && interaction.type !== this.type) {
			return false;
		}

		if (!(this.only.has(interaction.user.id) || this.#acceptAnyUser)) {
			return false;
		}

		if (interaction.data === undefined) {
			return false;
		}

		if (!this.anyCustomId) {
			if (interaction.data.customId === undefined) {
				return false;
			}

			const data = InteractionCollector.decodeId(interaction.data.customId);
			if (data[0] !== this.#baseId) {
				return false;
			}
		}

		return true;
	}

	/**
	 * @deprecated
	 * Do not use as this receives raw Discord interaction events, rather than Rost ones.
	 * Use {@link onInteraction()} instead.
	 */
	onCollect(_: CollectEvent<"interactionCreate">) {
		throw new Error("Do not use `onCollect()` on interaction controllers. Use `onInteraction()` instead.");
	}

	onInteraction(callback: (interaction: Rost.Interaction<Metadata, Parameters>) => PromiseOr<void>): void {
		super.onCollect(async (interactionRaw) => {
			const locales = await this.#getLocaleData(interactionRaw);
			const metadata = this.#getMetadata(interactionRaw);
			const parameters = this.#getParameters<Parameters>(interactionRaw);

			let name: string;
			if (
				interactionRaw.type === Discord.InteractionTypes.ApplicationCommand ||
				interactionRaw.type === Discord.InteractionTypes.ApplicationCommandAutocomplete
			) {
				name = InteractionCollector.getCommandName(interactionRaw);
			} else {
				name = constants.components.none;
			}

			const interaction: Rost.Interaction<Metadata, Parameters> = {
				...(interactionRaw as unknown as Rost.Interaction),
				...locales,
				...{
					displayLocale: parameters.show ? locales.guildLocale : locales.locale,
				},
				commandName: name,
				metadata,
				parameters,
			};

			await callback(interaction);
		});
	}

	async #getLocaleData(interaction: Interaction): Promise<Omit<Rost.InteractionLocaleData, "displayLocale">> {
		const member = this.#client.entities.members.get(interaction.guildId!)?.get(interaction.user.id);
		if (member === undefined) {
			return {
				locale: constants.defaults.GUILD_SOURCE_LOCALE,
				guildLocale: constants.defaults.GUILD_SOURCE_LOCALE,
			};
		}

		const guildDocument = await Guild.getOrCreate(this.#client, { guildId: interaction.guildId!.toString() });

		const guildLocale = guildDocument.isTargetLanguageOnlyChannel(interaction.channelId!.toString())
			? guildDocument.locales.target
			: guildDocument.locales.source;

		// Otherwise default to the user's app language.
		return { locale: interaction.locale, guildLocale };
	}

	#getMetadata(interaction: Interaction): Rost.Interaction<Metadata>["metadata"] {
		const idEncoded = interaction.data?.customId;
		if (idEncoded === undefined) {
			return [constants.components.none] as unknown as Rost.Interaction<Metadata>["metadata"];
		}

		return InteractionCollector.decodeId(idEncoded);
	}

	#getParameters<Parameters extends Record<string, DiscordParameterType>>(
		interaction: Interaction,
	): Rost.InteractionParameters<Parameters> {
		const options = interaction.data?.options;
		if (options === undefined) {
			return InteractionCollector.#defaultParameters as Rost.InteractionParameters<Parameters>;
		}

		return {
			...InteractionCollector.#defaultParameters,
			...InteractionCollector.#parseParameters(options),
		} as Rost.InteractionParameters<Parameters>;
	}

	static #parseParameters<Parameters extends Record<string, DiscordParameterType>>(
		options: Discord.InteractionDataOption[],
	): Partial<Parameters> {
		const result: Partial<Record<string, DiscordParameterType>> = {};

		for (const option of options) {
			if (option.focused) {
				result.focused = option.name;
			}

			if (option.options !== undefined) {
				const parameters = InteractionCollector.#parseParameters(option.options);
				for (const [key, value] of Object.entries(parameters)) {
					result[key] = value;
				}

				continue;
			}

			result[option.name] = option.value;
		}

		return result as unknown as Partial<Parameters>;
	}

	encodeId<Metadata extends string[] = []>(metadata: Metadata): string {
		return [this.customId, ...metadata].join(constants.special.interaction.separator);
	}

	static decodeId<Metadata extends string[] = []>(idEncoded: string): [customId: string, ...metadata: Metadata] {
		return idEncoded.split(constants.special.interaction.separator) as [customId: string, ...metadata: Metadata];
	}
}

export { Collector, InteractionCollector };
