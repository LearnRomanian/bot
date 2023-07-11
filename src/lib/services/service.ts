import { Client } from "../client";
import { Document } from "../database/document";
import { Guild } from "../database/structs/guild";
import * as Discord from "discordeno";

type ServiceBase = {
	[K in keyof Discord.EventHandlers]: (..._: Parameters<Discord.EventHandlers[K]>) => Promise<void>;
};

abstract class Service implements ServiceBase {
	readonly client: Client;

	constructor(client: Client) {
		this.client = client;
	}

	async start(_: Discord.Bot): Promise<void> {}

	async debug(..._: Parameters<ServiceBase["debug"]>) {}
	async auditLogEntryCreate(..._: Parameters<ServiceBase["auditLogEntryCreate"]>) {}
	async automodRuleCreate(..._: Parameters<ServiceBase["automodRuleCreate"]>) {}
	async automodRuleUpdate(..._: Parameters<ServiceBase["automodRuleUpdate"]>) {}
	async automodRuleDelete(..._: Parameters<ServiceBase["automodRuleDelete"]>) {}
	async automodActionExecution(..._: Parameters<ServiceBase["automodActionExecution"]>) {}
	async threadCreate(..._: Parameters<ServiceBase["threadCreate"]>) {}
	async threadDelete(..._: Parameters<ServiceBase["threadDelete"]>) {}
	async threadMemberUpdate(..._: Parameters<ServiceBase["threadMemberUpdate"]>) {}
	async threadMembersUpdate(..._: Parameters<ServiceBase["threadMembersUpdate"]>) {}
	async threadUpdate(..._: Parameters<ServiceBase["threadUpdate"]>) {}
	async scheduledEventCreate(..._: Parameters<ServiceBase["scheduledEventCreate"]>) {}
	async scheduledEventUpdate(..._: Parameters<ServiceBase["scheduledEventUpdate"]>) {}
	async scheduledEventDelete(..._: Parameters<ServiceBase["scheduledEventDelete"]>) {}
	async scheduledEventUserAdd(..._: Parameters<ServiceBase["scheduledEventUserAdd"]>) {}
	async scheduledEventUserRemove(..._: Parameters<ServiceBase["scheduledEventUserRemove"]>) {}
	async ready(..._: Parameters<ServiceBase["ready"]>) {}
	async interactionCreate(..._: Parameters<ServiceBase["interactionCreate"]>) {}
	async integrationCreate(..._: Parameters<ServiceBase["integrationCreate"]>) {}
	async integrationDelete(..._: Parameters<ServiceBase["integrationDelete"]>) {}
	async integrationUpdate(..._: Parameters<ServiceBase["integrationUpdate"]>) {}
	async inviteCreate(..._: Parameters<ServiceBase["inviteCreate"]>) {}
	async inviteDelete(..._: Parameters<ServiceBase["inviteDelete"]>) {}
	async guildMemberAdd(..._: Parameters<ServiceBase["guildMemberAdd"]>) {}
	async guildMemberRemove(..._: Parameters<ServiceBase["guildMemberRemove"]>) {}
	async guildMemberUpdate(..._: Parameters<ServiceBase["guildMemberUpdate"]>) {}
	async messageCreate(..._: Parameters<ServiceBase["messageCreate"]>) {}
	async messageDelete(..._: Parameters<ServiceBase["messageDelete"]>) {}
	async messageDeleteBulk(..._: Parameters<ServiceBase["messageDeleteBulk"]>) {}
	async messageUpdate(..._: Parameters<ServiceBase["messageUpdate"]>) {}
	async reactionAdd(..._: Parameters<ServiceBase["reactionAdd"]>) {}
	async reactionRemove(..._: Parameters<ServiceBase["reactionRemove"]>) {}
	async reactionRemoveEmoji(..._: Parameters<ServiceBase["reactionRemoveEmoji"]>) {}
	async reactionRemoveAll(..._: Parameters<ServiceBase["reactionRemoveAll"]>) {}
	async presenceUpdate(..._: Parameters<ServiceBase["presenceUpdate"]>) {}
	async voiceServerUpdate(..._: Parameters<ServiceBase["voiceServerUpdate"]>) {}
	async voiceStateUpdate(..._: Parameters<ServiceBase["voiceStateUpdate"]>) {}
	async channelCreate(..._: Parameters<ServiceBase["channelCreate"]>) {}
	async dispatchRequirements(..._: Parameters<ServiceBase["dispatchRequirements"]>) {}
	async channelDelete(..._: Parameters<ServiceBase["channelDelete"]>) {}
	async channelPinsUpdate(..._: Parameters<ServiceBase["channelPinsUpdate"]>) {}
	async channelUpdate(..._: Parameters<ServiceBase["channelUpdate"]>) {}
	async stageInstanceCreate(..._: Parameters<ServiceBase["stageInstanceCreate"]>) {}
	async stageInstanceDelete(..._: Parameters<ServiceBase["stageInstanceDelete"]>) {}
	async stageInstanceUpdate(..._: Parameters<ServiceBase["stageInstanceUpdate"]>) {}
	async guildEmojisUpdate(..._: Parameters<ServiceBase["guildEmojisUpdate"]>) {}
	async guildBanAdd(..._: Parameters<ServiceBase["guildBanAdd"]>) {}
	async guildBanRemove(..._: Parameters<ServiceBase["guildBanRemove"]>) {}
	async guildCreate(..._: Parameters<ServiceBase["guildCreate"]>) {}
	async guildDelete(..._: Parameters<ServiceBase["guildDelete"]>) {}
	async guildUpdate(..._: Parameters<ServiceBase["guildUpdate"]>) {}
	async raw(..._: Parameters<ServiceBase["raw"]>) {}
	async roleCreate(..._: Parameters<ServiceBase["roleCreate"]>) {}
	async roleDelete(..._: Parameters<ServiceBase["roleDelete"]>) {}
	async roleUpdate(..._: Parameters<ServiceBase["roleUpdate"]>) {}
	async webhooksUpdate(..._: Parameters<ServiceBase["webhooksUpdate"]>) {}
	async botUpdate(..._: Parameters<ServiceBase["botUpdate"]>) {}
	async typingStart(..._: Parameters<ServiceBase["typingStart"]>) {}
}

abstract class GlobalService extends Service {}

abstract class LocalService extends Service {
	protected readonly guildId: bigint;
	protected readonly guildIdString: string;

	get guild(): Discord.Guild | undefined {
		return this.client.cache.guilds.get(this.guildId);
	}

	get guildDocument(): Document<Guild> | undefined {
		return this.client.database.cache.guildById.get(this.guildIdString);
	}

	constructor(client: Client, guildId: bigint) {
		super(client);
		this.guildId = guildId;
		this.guildIdString = guildId.toString();
	}
}

export { Service, GlobalService, LocalService, ServiceBase };
