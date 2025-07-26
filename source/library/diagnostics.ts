import { code } from "rost:constants/formatting";
import type { Client } from "rost/client";

type ID = bigint | string;
type IndexOr<T> = T | ID;

function isId<T>(object: IndexOr<T>): object is bigint | string {
	return typeof object === "bigint" || typeof object === "string";
}

type UserLike = Rost.User | Discord.User | Discord.Camelize<Discord.DiscordUser>;
type MemberLike = Rost.Member | Discord.Member | Discord.Camelize<Discord.DiscordMember>;
type RoleLike = Rost.Role | Discord.Role | Discord.Camelize<Discord.DiscordRole>;
type GuildLike = Rost.Guild | Discord.Guild | Discord.Camelize<Discord.DiscordGuild>;
type MessageLike = Rost.Message | Discord.Message | Discord.Camelize<Discord.DiscordMessage>;
type ChannelLike = Rost.Channel | Discord.Channel | Discord.Camelize<Discord.DiscordChannel>;
type InteractionLike = Rost.Interaction | Discord.Interaction;

class Diagnostics {
	readonly #client: Client;

	constructor(client: Client) {
		this.#client = client;
	}

	user(userOrId: IndexOr<UserLike>, options?: { prettify?: boolean }): string {
		let user: UserLike;
		if (isId(userOrId)) {
			if (!this.#client.entities.users.has(BigInt(userOrId))) {
				return `uncached user (ID ${userOrId})`;
			}

			user = this.#client.entities.users.get(BigInt(userOrId))!;
		} else {
			user = userOrId;
		}

		const tag = user.discriminator === "0" ? user.username : `${user.username}#${user.discriminator}`;

		if (options?.prettify) {
			return `${tag} · ID ${user.id}`;
		}

		return `${tag} (ID ${user.id})`;
	}

	member(member: MemberLike): string {
		let userFormatted: string;
		if (member.user !== undefined) {
			userFormatted = this.user(member.user);
		} else if ("id" in member) {
			userFormatted = this.user(member.id);
		} else {
			userFormatted = "unknown user";
		}

		let guildFormatted: string;
		if ("guildId" in member) {
			guildFormatted = this.guild(member.guildId);
		} else {
			guildFormatted = "unknown guild";
		}

		return `${userFormatted} @ ${guildFormatted}`;
	}

	role(roleOrId: IndexOr<RoleLike>): string {
		let role: RoleLike;
		if (isId(roleOrId)) {
			if (!this.#client.entities.roles.has(BigInt(roleOrId))) {
				return `uncached role (ID ${roleOrId})`;
			}

			role = this.#client.entities.roles.get(BigInt(roleOrId))!;
		} else {
			role = roleOrId;
		}

		return `role '${role.name}' (ID ${role.id})`;
	}

	guild(guildOrId: IndexOr<GuildLike>): string {
		let guild: GuildLike;
		if (isId(guildOrId)) {
			if (!this.#client.entities.guilds.has(BigInt(guildOrId))) {
				return `uncached guild (ID ${guildOrId})`;
			}

			guild = this.#client.entities.guilds.get(BigInt(guildOrId))!;
		} else {
			guild = guildOrId;
		}

		return `guild '${guild.name}' (ID ${guild.id})`;
	}

	message(messageOrId: IndexOr<MessageLike>): string {
		let message: MessageLike;
		if (isId(messageOrId)) {
			if (!this.#client.entities.messages.latest.has(BigInt(messageOrId))) {
				return `uncached guild (ID ${messageOrId})`;
			}

			message = this.#client.entities.messages.latest.get(BigInt(messageOrId))!;
		} else {
			message = messageOrId;
		}

		const contentLength = message.content?.length ?? 0;
		const embedCount = message.embeds?.length ?? 0;
		const userFormatted = this.user(message.author.id);

		return `message of length ${contentLength} with ${embedCount} embeds (ID ${message.id}) posted by ${userFormatted}`;
	}

	channel(channelOrId: IndexOr<ChannelLike>): string {
		let channel: ChannelLike;
		if (isId(channelOrId)) {
			if (!this.#client.entities.channels.has(BigInt(channelOrId))) {
				return `uncached channel (ID ${channelOrId})`;
			}

			channel = this.#client.entities.channels.get(BigInt(channelOrId))!;
		} else {
			channel = channelOrId;
		}

		let guildFormatted: string;
		if (channel.guildId !== undefined) {
			guildFormatted = this.guild(channel.guildId);
		} else {
			guildFormatted = "unknown guild";
		}

		let channelTypeFormatted: string;
		switch (channel.type) {
			case Discord.ChannelTypes.GuildText: {
				channelTypeFormatted = "text channel";
				break;
			}
			case Discord.ChannelTypes.DM: {
				channelTypeFormatted = "DM channel";
				break;
			}
			case Discord.ChannelTypes.GroupDm: {
				channelTypeFormatted = "group DM channel";
				break;
			}
			case Discord.ChannelTypes.GuildVoice: {
				channelTypeFormatted = "voice channel";
				break;
			}
			case Discord.ChannelTypes.GuildStageVoice: {
				channelTypeFormatted = "stage channel";
				break;
			}
			case Discord.ChannelTypes.GuildAnnouncement: {
				channelTypeFormatted = "guild announcement";
				break;
			}
			case Discord.ChannelTypes.AnnouncementThread: {
				channelTypeFormatted = "announcement thread";
				break;
			}
			case Discord.ChannelTypes.PublicThread: {
				channelTypeFormatted = "public thread";
				break;
			}
			case Discord.ChannelTypes.PrivateThread: {
				channelTypeFormatted = "private thread";
				break;
			}
			default: {
				channelTypeFormatted = `unknown channel type (ID ${channel.type})`;
				break;
			}
		}

		if (channel.name === undefined) {
			return `unnamed ${channelTypeFormatted} (ID ${channel.id}) @ ${guildFormatted}`;
		}

		return `${channelTypeFormatted} '${channel.name}' (ID ${channel.id}) @ ${guildFormatted}`;
	}

	interaction(interaction: InteractionLike): string {
		let memberFormatted: string;
		if (interaction.member !== undefined) {
			memberFormatted = this.member(interaction.member);
		} else {
			memberFormatted = "unknown member";
		}

		let interactionTypeFormatted: string;
		switch (interaction.type) {
			case Discord.InteractionTypes.Ping: {
				interactionTypeFormatted = "ping interaction";
				break;
			}
			case Discord.InteractionTypes.ApplicationCommand: {
				if ("commandName" in interaction) {
					interactionTypeFormatted = `command interaction (${code(interaction.commandName)})`;
				} else {
					interactionTypeFormatted = "command interaction (unknown command)";
				}
				break;
			}
			case Discord.InteractionTypes.MessageComponent: {
				const customId = interaction.data?.customId;
				if (customId !== undefined) {
					interactionTypeFormatted = `component interaction (${code(customId)}})`;
				} else {
					interactionTypeFormatted = "component interaction (unknown custom ID)";
				}
				break;
			}
			case Discord.InteractionTypes.ApplicationCommandAutocomplete: {
				if ("commandName" in interaction) {
					interactionTypeFormatted = `autocomplete interaction (${code(interaction.commandName)})`;
				} else {
					interactionTypeFormatted = "autocomplete interaction (unknown command)";
				}
				break;
			}
			case Discord.InteractionTypes.ModalSubmit: {
				interactionTypeFormatted = "modal interaction";
				break;
			}
			default: {
				interactionTypeFormatted = `unknown interaction type (ID ${interaction.type})`;
				break;
			}
		}

		return `${interactionTypeFormatted} (ID ${interaction.id}) from ${memberFormatted}`;
	}
}

export { Diagnostics };
