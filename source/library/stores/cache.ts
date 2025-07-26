import type { Collection } from "rost:constants/database";
import type { DesiredProperties, DesiredPropertiesBehaviour } from "rost:constants/properties";
import type { PromiseOr } from "rost:core/utilities";
import type pino from "pino";
import type { EntryRequest } from "rost/models/entry-request";
import type { Guild } from "rost/models/guild";
import type { Model } from "rost/models/model";
import type { Praise } from "rost/models/praise";
import type { Report } from "rost/models/report";
import type { Resource } from "rost/models/resource";
import type { Suggestion } from "rost/models/suggestion";
import type { Ticket } from "rost/models/ticket";
import type { User } from "rost/models/user";
import type { Warning } from "rost/models/warning";

class CacheStore {
	readonly log: pino.Logger;
	readonly entities: {
		readonly guilds: Map<bigint, Rost.Guild>;
		readonly users: Map<bigint, Rost.User>;
		readonly members: Map</* guildId: */ bigint, Map</* userId: */ bigint, Rost.Member>>;
		readonly channels: Map<bigint, Rost.Channel>;
		readonly messages: {
			readonly latest: Map<bigint, Rost.Message>;
			readonly previous: Map<bigint, Rost.Message>;
		};
		readonly attachments: Map<bigint, Rost.Attachment>;
		readonly roles: Map<bigint, Rost.Role>;
	};
	readonly documents: {
		readonly entryRequests: Map<string, EntryRequest>;
		readonly guilds: Map<string, Guild>;
		readonly praisesByAuthor: Map<string, Map<string, Praise>>;
		readonly praisesByTarget: Map<string, Map<string, Praise>>;
		readonly reports: Map<string, Report>;
		readonly resources: Map<string, Resource>;
		readonly suggestions: Map<string, Suggestion>;
		readonly tickets: Map<string, Ticket>;
		readonly users: Map<string, User>;
		readonly warningsByTarget: Map<string, Map<string, Warning>>;
	};

	readonly #fetchRequests: Set<bigint>;

	constructor({ log }: { log: pino.Logger }) {
		this.log = log.child({ name: "CacheStore" });
		this.entities = {
			guilds: new Map(),
			users: new Map(),
			members: new Map(),
			channels: new Map(),
			messages: {
				latest: new Map(),
				previous: new Map(),
			},
			attachments: new Map(),
			roles: new Map(),
		};
		this.documents = {
			entryRequests: new Map(),
			guilds: new Map(),
			praisesByAuthor: new Map(),
			praisesByTarget: new Map(),
			reports: new Map(),
			resources: new Map(),
			suggestions: new Map(),
			tickets: new Map(),
			users: new Map(),
			warningsByTarget: new Map(),
		};

		this.#fetchRequests = new Set();
	}

	buildCacheHandlers(): Partial<Discord.Transformers<DesiredProperties, DesiredPropertiesBehaviour>["customizers"]> {
		return {
			guild: this.#cacheEntity(this.#cacheGuild.bind(this)),
			channel: this.#cacheEntity(this.#cacheChannel.bind(this)),
			user: this.#cacheEntity(this.#cacheUser.bind(this)),
			member: this.#cacheEntity(this.#cacheMember.bind(this)),
			message: this.#cacheEntity(this.#cacheMessage.bind(this)),
			attachment: this.#cacheEntity(this.#cacheAttachment.bind(this)),
			role: this.#cacheEntity(this.#cacheRole.bind(this)),
			voiceState: this.#cacheEntity(this.#cacheVoiceState.bind(this)),
		};
	}

	#cacheEntity<T>(
		callback: (entity: T) => PromiseOr<void>,
	): (bot: Discord.Bot<DesiredProperties, DesiredPropertiesBehaviour>, payload: unknown, entity: T) => T {
		return (_, __, entity) => {
			callback(entity);
			return entity;
		};
	}

	#cacheGuild(guild_: Discord.Guild): void {
		const oldGuild = this.entities.guilds.get(guild_.id);
		const guild = {
			...(guild_ as unknown as Rost.Guild),
			roles: new Discord.Collection([...(oldGuild?.roles ?? []), ...(guild_.roles ?? [])]),
			emojis: new Discord.Collection([...(oldGuild?.emojis ?? []), ...(guild_.emojis ?? [])]),
			voiceStates: new Discord.Collection([...(oldGuild?.voiceStates ?? []), ...(guild_.voiceStates ?? [])]),
			members: new Discord.Collection([...(oldGuild?.members ?? []), ...(guild_.members ?? [])]),
			channels: new Discord.Collection([...(oldGuild?.channels ?? []), ...(guild_.channels ?? [])]),
			threads: new Discord.Collection([...(oldGuild?.threads ?? []), ...(guild_.threads ?? [])]),
		};

		this.entities.guilds.set(guild.id, guild);

		for (const channel of guild.channels?.array() ?? []) {
			this.#cacheChannel(channel);
		}
	}

	#cacheChannel(channel: Discord.Channel): void {
		this.entities.channels.set(channel.id, channel);

		if (channel.guildId !== undefined) {
			this.entities.guilds.get(channel.guildId)?.channels?.set(channel.id, channel);
		}
	}

	#cacheUser(user: Discord.User): void {
		this.entities.users.set(user.id, user);
	}

	#cacheMember(member: Discord.Member): void {
		if (this.entities.members.has(member.guildId)) {
			this.entities.members.get(member.guildId)!.set(member.id, member);
		} else {
			this.entities.members.set(member.guildId, new Map([[member.id, member]]));
		}

		this.entities.guilds.get(member.guildId)?.members?.set(member.id, member);
	}

	#cacheMessage(message: Discord.Message): void {
		const previousMessage = this.entities.messages.latest.get(message.id);
		if (previousMessage !== undefined) {
			this.entities.messages.previous.set(message.id, previousMessage);
		}

		this.entities.messages.latest.set(message.id, message);
	}

	async #cacheAttachment(attachment: Discord.Attachment): Promise<void> {
		if (this.entities.attachments.has(attachment.id) || this.#fetchRequests.has(attachment.id)) {
			return;
		}

		this.#fetchRequests.add(attachment.id);

		const blob = await fetch(attachment.url).then((response) => response.blob());

		this.entities.attachments.set(
			attachment.id,
			// @ts-ignore: Discordeno expects the Node `Blob`, while we can only provide a bun `Blob`.
			Object.assign(attachment, { name: attachment.filename, blob }),
		);

		this.#fetchRequests.delete(attachment.id);
	}

	#cacheRole(role: Discord.Role): void {
		this.entities.roles.set(role.id, role);

		this.entities.guilds.get(role.guildId)?.roles?.set(role.id, role);
	}

	#cacheVoiceState(voiceState: Discord.VoiceState): void {
		if (voiceState.channelId !== undefined) {
			this.entities.guilds.get(voiceState.guildId)?.voiceStates?.set(voiceState.userId, voiceState);
		} else {
			this.entities.guilds.get(voiceState.guildId)?.voiceStates?.delete(voiceState.userId);
		}
	}

	cacheDocuments<M extends Model>(documents: M[]): void {
		if (documents.length === 0) {
			return;
		}

		this.log.debug(`Caching ${documents.length} documents...`);

		for (const document of documents) {
			this.cacheDocument(document);
		}
	}

	cacheDocument(document: any): void {
		switch (document.collection as Collection) {
			case "DatabaseMetadata": {
				// Uncached
				break;
			}
			case "EntryRequests": {
				this.documents.entryRequests.set(document.partialId, document);
				break;
			}
			case "Guilds": {
				this.documents.guilds.set(document.partialId, document);
				break;
			}
			case "Praises": {
				if (this.documents.praisesByAuthor.has(document.authorId)) {
					this.documents.praisesByAuthor.get(document.authorId)?.set(document.partialId, document);
				} else {
					this.documents.praisesByAuthor.set(document.authorId, new Map([[document.partialId, document]]));
				}

				if (this.documents.praisesByTarget.has(document.targetId)) {
					this.documents.praisesByTarget.get(document.targetId)?.set(document.partialId, document);
				} else {
					this.documents.praisesByTarget.set(document.targetId, new Map([[document.partialId, document]]));
				}

				break;
			}
			case "Reports": {
				this.documents.reports.set(document.partialId, document);
				break;
			}
			case "Resources": {
				this.documents.resources.set(document.partialId, document);
				break;
			}
			case "Suggestions": {
				this.documents.suggestions.set(document.partialId, document);
				break;
			}
			case "Tickets": {
				this.documents.tickets.set(document.partialId, document);
				break;
			}
			case "Users": {
				this.documents.users.set(document.partialId, document);
				break;
			}
			case "Warnings": {
				if (this.documents.warningsByTarget.has(document.targetId)) {
					this.documents.warningsByTarget.get(document.targetId)?.set(document.partialId, document);
				} else {
					this.documents.warningsByTarget.set(document.targetId, new Map([[document.partialId, document]]));
				}
				break;
			}
		}
	}

	unloadDocument(document: any): void {
		switch (document.collection as Collection) {
			case "DatabaseMetadata": {
				// Uncached
				break;
			}
			case "EntryRequests": {
				this.documents.entryRequests.delete(document.partialId);
				break;
			}
			case "Guilds": {
				this.documents.guilds.delete(document.partialId);
				break;
			}
			case "Praises": {
				if (this.documents.praisesByAuthor.has(document.authorId)) {
					this.documents.praisesByAuthor.get(document.authorId)?.delete(document.partialId);
				}

				if (this.documents.praisesByTarget.has(document.targetId)) {
					this.documents.praisesByTarget.get(document.targetId)?.delete(document.partialId);
				}

				break;
			}
			case "Reports": {
				this.documents.reports.delete(document.partialId);
				break;
			}
			case "Resources": {
				this.documents.resources.delete(document.partialId);
				break;
			}
			case "Suggestions": {
				this.documents.suggestions.delete(document.partialId);
				break;
			}
			case "Tickets": {
				this.documents.tickets.delete(document.partialId);
				break;
			}
			case "Users": {
				this.documents.users.delete(document.partialId);
				break;
			}
			case "Warnings": {
				if (this.documents.warningsByTarget.has(document.targetId)) {
					this.documents.warningsByTarget.get(document.targetId)?.delete(document.partialId);
				}
				break;
			}
		}
	}
}

export { CacheStore };
