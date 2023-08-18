import { Guild } from "../../database/structs/guild";
import diagnostics from "../../diagnostics";
import { LocalService } from "../service";
import { Events, MessageGenerators } from "./generator";
import generators from "./generators";
import * as Discord from "@discordeno/bot";

const messageGenerators: MessageGenerators<Events> = { ...generators.client, ...generators.guild };

type Configuration = NonNullable<Guild["features"]["information"]["features"]>["journaling"];

class JournallingService extends LocalService {
	get configuration(): Configuration | undefined {
		const guildDocument = this.guildDocument;
		if (guildDocument === undefined) {
			return undefined;
		}

		return guildDocument.data.features.information.features?.journaling;
	}

	get channelId(): bigint | undefined {
		const configuration = this.configuration;
		if (configuration === undefined) {
			return undefined;
		}

		if (!configuration.enabled) {
			return undefined;
		}

		const channelId = BigInt(configuration.channelId);
		if (channelId === undefined) {
			return undefined;
		}

		return channelId;
	}

	async log<Event extends keyof Events>(event: Event, { args }: { args: Events[Event] }): Promise<void> {
		const journalEntryGenerator = messageGenerators[event];
		if (journalEntryGenerator === undefined) {
			return;
		}

		const channelId = this.channelId;
		if (channelId === undefined) {
			return;
		}

		if (!journalEntryGenerator.filter(this.client, this.guildId, ...args)) {
			return;
		}

		const journalEntry = await journalEntryGenerator.message(this.client, ...args);
		if (journalEntry === undefined) {
			return;
		}

		await this.bot.rest
			.sendMessage(channelId, {
				embeds: [
					{
						title: journalEntryGenerator.title,
						description: journalEntry,
						color: journalEntryGenerator.color,
					},
				],
			})
			.catch(() =>
				this.client.log.warn(`Failed to log '${event}' event on ${diagnostics.display.guild(this.guildId)}.`),
			);
	}

	async guildBanAdd(user: Discord.User, guildId: bigint): Promise<void> {
		this.log("guildBanAdd", { args: [user, guildId] });
	}

	async guildBanRemove(user: Discord.User, guildId: bigint): Promise<void> {
		this.log("guildBanRemove", { args: [user, guildId] });
	}

	async guildMemberAdd(member: Discord.Member, user: Discord.User): Promise<void> {
		this.log("guildMemberAdd", { args: [member, user] });
	}

	async guildMemberRemove(user: Discord.User, guildId: bigint): Promise<void> {
		this.log("guildMemberRemove", { args: [user, guildId] });
	}

	async messageDelete(
		payload: { id: bigint; channelId: bigint; guildId?: bigint | undefined },
		message?: Discord.Message | undefined,
	): Promise<void> {
		this.log("messageDelete", { args: [payload, message] });
	}

	async messageUpdate(message: Discord.Message, oldMessage?: Discord.Message | undefined): Promise<void> {
		this.log("messageUpdate", { args: [message, oldMessage] });
	}
}

export { JournallingService };
