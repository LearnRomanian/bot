import {
	Bot,
	ButtonStyles,
	CreateMessage,
	getAvatarURL,
	Guild,
	Interaction,
	MessageComponentTypes,
	User as DiscordUser,
} from 'discordeno';
import { PromptManager } from 'logos/src/lib/services/prompts/manager.ts';
import { stringifyValue } from 'logos/src/lib/database/database.ts';
import { Document } from 'logos/src/lib/database/document.ts';
import { Suggestion, User } from 'logos/src/lib/database/structs/mod.ts';
import { Client, localise, WithLanguage } from 'logos/src/lib/client.ts';
import { encodeId, reply } from 'logos/src/lib/interactions.ts';
import configuration from 'logos/src/configuration.ts';
import constants from 'logos/src/constants.ts';
import { mention, MentionTypes, timestamp } from 'logos/src/formatting.ts';
import { defaultLocale } from 'logos/src/types.ts';

type Metadata = { userId: bigint; reference: string };
type InteractionData = [userId: string, guildId: string, reference: string, isResolved: string];

class SuggestionManager extends PromptManager<Suggestion, Metadata, InteractionData> {
	getAllDocuments(client: Client): Map<bigint, Document<Suggestion>[]> {
		const suggestionsByGuildId = new Map<bigint, Document<Suggestion>[]>();

		for (
			const suggestions of Array.from(client.database.cache.suggestionsByAuthorAndGuild.values())
				.map((suggestions) => Array.from(suggestions.values()))
		) {
			if (suggestions.length === 0) continue;

			const guildId = BigInt(suggestions.at(0)!.data.guild);

			if (!suggestionsByGuildId.has(guildId)) {
				suggestionsByGuildId.set(guildId, suggestions);
				continue;
			}

			suggestionsByGuildId.get(guildId)!.push(...suggestions);
		}

		return suggestionsByGuildId;
	}

	getUserDocument(client: Client, document: Document<Suggestion>): Promise<Document<User> | undefined> {
		return client.database.adapters.users.getOrFetch(client, 'reference', document.data.author);
	}

	decodeMetadata(data: string[]): Metadata | undefined {
		const [userId, reference] = data;
		if (userId === undefined || reference === undefined) return undefined;

		return { userId: BigInt(userId), reference };
	}

	getPromptContent(
		[client, bot]: [Client, Bot],
		guild: WithLanguage<Guild>,
		user: DiscordUser,
		document: Document<Suggestion>,
	): CreateMessage {
		const reference = stringifyValue(document.ref);

		const strings = {
			suggestion: {
				submittedBy: localise(client, 'submittedBy', defaultLocale)(),
				submittedAt: localise(client, 'submittedAt', defaultLocale)(),
			},
			markResolved: localise(client, 'markResolved', defaultLocale)(),
			markUnresolved: localise(client, 'markUnresolved', defaultLocale)(),
		};

		return {
			embeds: [{
				title: document.data.suggestion,
				color: constants.colors.green,
				thumbnail: (() => {
					const iconURL = getAvatarURL(bot, user.id, user.discriminator, {
						avatar: user.avatar,
						size: 64,
						format: 'png',
					});
					if (iconURL === undefined) return;

					return { url: iconURL };
				})(),
				fields: [
					{
						name: strings.suggestion.submittedBy,
						value: mention(user.id, MentionTypes.User),
						inline: true,
					},
					{
						name: strings.suggestion.submittedAt,
						value: timestamp(document.data.createdAt),
						inline: true,
					},
				],
				footer: { text: `${user.id}${constants.symbols.meta.metadataSeparator}${reference}` },
			}],
			components: [{
				type: MessageComponentTypes.ActionRow,
				components: [
					!document.data.isResolved
						? {
							type: MessageComponentTypes.Button,
							style: ButtonStyles.Primary,
							label: strings.markResolved,
							customId: encodeId<InteractionData>(
								constants.staticComponentIds.suggestions,
								[user.id.toString(), guild.id.toString(), reference, `${true}`],
							),
						}
						: {
							type: MessageComponentTypes.Button,
							style: ButtonStyles.Secondary,
							label: strings.markUnresolved,
							customId: encodeId<InteractionData>(
								constants.staticComponentIds.suggestions,
								[user.id.toString(), guild.id.toString(), reference, `${false}`],
							),
						},
				],
			}],
		};
	}

	async handleInteraction(
		[client, bot]: [Client, Bot],
		interaction: Interaction,
		data: InteractionData,
	): Promise<Document<Suggestion> | null | undefined> {
		const [userId, guildId, reference, isResolvedString] = data;
		const isResolved = isResolvedString === 'true';

		const user = await client.database.adapters.users.getOrFetchOrCreate(client, 'id', userId, BigInt(userId));
		if (user === undefined) return undefined;

		const documents = client.database.adapters.suggestions.get(client, 'authorAndGuild', [user.ref, guildId]);
		if (documents === undefined) return undefined;

		const document = documents.get(reference);
		if (document === undefined) return undefined;

		if (isResolved && document.data.isResolved) {
			const strings = {
				title: localise(client, 'alreadyMarkedResolved.title', defaultLocale)(),
				description: localise(client, 'alreadyMarkedResolved.description', defaultLocale)(),
			};

			return void reply([client, bot], interaction, {
				embeds: [{
					title: strings.title,
					description: strings.description,
					color: constants.colors.dullYellow,
				}],
			});
		}

		if (!isResolved && !document.data.isResolved) {
			const strings = {
				title: localise(client, 'alreadyMarkedUnresolved.title', defaultLocale)(),
				description: localise(client, 'alreadyMarkedUnresolved.description', defaultLocale)(),
			};

			return void reply([client, bot], interaction, {
				embeds: [{
					title: strings.title,
					description: strings.description,
					color: constants.colors.dullYellow,
				}],
			});
		}

		const updatedDocument = await client.database.adapters.suggestions.update(
			client,
			{ ...document, data: { ...document.data, isResolved } },
		);

		return updatedDocument;
	}
}

const manager = new SuggestionManager({
	customId: constants.staticComponentIds.suggestions,
	channelName: configuration.guilds.channels.suggestions,
	type: 'suggestion',
});

export default manager;
