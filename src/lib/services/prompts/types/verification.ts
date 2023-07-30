import constants from "../../../../constants/constants";
import { defaultLanguage, defaultLocale } from "../../../../constants/language";
import { MentionTypes, TimestampFormat, mention, timestamp } from "../../../../formatting";
import * as Logos from "../../../../types";
import { Client, localise, pluralise } from "../../../client";
import { stringifyValue } from "../../../database/database";
import { Document } from "../../../database/document";
import { EntryRequest } from "../../../database/structs/entry-request";
import { User } from "../../../database/structs/user";
import diagnostics from "../../../diagnostics";
import { acknowledge, encodeId, reply } from "../../../interactions";
import { getGuildIconURLFormatted, snowflakeToTimestamp } from "../../../utils";
import { Configurations, PromptService } from "../service";
import * as Discord from "discordeno";

type Metadata = { userId: bigint; reference: string };
type InteractionData = [userId: string, guildId: string, reference: string, isAccept: string];

type Configuration = Configurations["verification"];
type VoteInformation = {
	[K in keyof NonNullable<Configuration["voting"]>["verdict"]]: {
		required: number;
		remaining: number;
	};
};

class VerificationService extends PromptService<"verification", EntryRequest, Metadata, InteractionData> {
	constructor(client: Client, guildId: bigint) {
		super(client, guildId, { type: "verification" });
	}

	getAllDocuments(): Document<EntryRequest>[] {
		const entryRequests: Document<EntryRequest>[] = [];

		for (const [compositeId, entryRequest] of this.client.database.cache.entryRequestBySubmitterAndGuild.entries()) {
			const [_, guildIdString] = compositeId.split(constants.symbols.meta.idSeparator);
			if (guildIdString === undefined) {
				continue;
			}

			if (guildIdString !== this.guildIdString) {
				continue;
			}

			if (entryRequest.data.isFinalised) {
				continue;
			}

			entryRequests.push(entryRequest);
		}

		return entryRequests;
	}

	getUserDocument(document: Document<EntryRequest>): Promise<Document<User> | undefined> {
		return this.client.database.adapters.users.getOrFetch(this.client, "reference", document.data.submitter);
	}

	decodeMetadata(data: string[]): Metadata | undefined {
		const [userId, reference] = data;
		if (userId === undefined || reference === undefined) {
			return undefined;
		}

		return { userId: BigInt(userId), reference };
	}

	getPromptContent(
		bot: Discord.Bot,
		user: Logos.User,
		document: Document<EntryRequest>,
	): Discord.CreateMessage | undefined {
		const [guild, guildDocument] = [this.guild, this.guildDocument];
		if (guild === undefined || guildDocument === undefined) {
			return undefined;
		}

		const reference = stringifyValue(document.ref);

		const voteInformation = this.getVoteInformation(document.data);
		if (voteInformation === undefined) {
			return undefined;
		}

		const strings = {
			verification: {
				reason: localise(
					this.client,
					"verification.fields.reason",
					defaultLocale,
				)({ language: guildDocument.data.language }),
				aim: localise(this.client, "verification.fields.aim", defaultLocale)(),
				whereFound: localise(this.client, "verification.fields.whereFound", defaultLocale)(),
			},
			answers: localise(this.client, "entry.verification.answers", defaultLocale)(),
			requestedRoles: localise(this.client, "entry.verification.requestedRoles", defaultLocale)(),
			accountCreated: localise(this.client, "entry.verification.accountCreated", defaultLocale)(),
			answersSubmitted: localise(this.client, "entry.verification.answersSubmitted", defaultLocale)(),
			accept: localise(this.client, "entry.verification.vote.accept", defaultLocale)(),
			acceptMultiple: localise(
				this.client,
				"entry.verification.vote.acceptMultiple",
				defaultLocale,
			)({
				votes: pluralise(
					this.client,
					"entry.verification.vote.acceptMultiple.votes",
					defaultLanguage,
					voteInformation.acceptance.remaining,
				),
			}),
			reject: localise(this.client, "entry.verification.vote.reject", defaultLocale)(),
			rejectMultiple: localise(
				this.client,
				"entry.verification.vote.rejectMultiple",
				defaultLocale,
			)({
				votes: pluralise(
					this.client,
					"entry.verification.vote.rejectMultiple.votes",
					defaultLanguage,
					voteInformation.rejection.required,
				),
			}),
		};

		const accountCreatedRelativeTimestamp = timestamp(snowflakeToTimestamp(user.id), TimestampFormat.Relative);
		const accountCreatedLongDateTimestamp = timestamp(snowflakeToTimestamp(user.id), TimestampFormat.LongDate);

		return {
			embeds: [
				{
					title: strings.answers,
					color: constants.colors.turquoise,
					thumbnail: (() => {
						const iconURL = Discord.getAvatarURL(bot, user.id, user.discriminator, {
							avatar: user.avatar,
							size: 64,
							format: "webp",
						});
						if (iconURL === undefined) {
							return;
						}

						return { url: iconURL };
					})(),
					fields: [
						{
							name: `1. ${strings.verification.reason}`,
							value: document.data.answers.reason,
						},
						{
							name: `2. ${strings.verification.aim}`,
							value: document.data.answers.aim,
						},
						{
							name: `3. ${strings.verification.whereFound}`,
							value: document.data.answers.whereFound,
						},
					],
				},
				{
					title: diagnostics.display.user(user),
					color: constants.colors.turquoise,
					fields: [
						{
							name: strings.requestedRoles,
							value: mention(BigInt(document.data.requestedRole), MentionTypes.Role),
							inline: true,
						},
						{
							name: strings.accountCreated,
							value: `${accountCreatedLongDateTimestamp} (${accountCreatedRelativeTimestamp})`,
							inline: true,
						},
						{
							name: strings.answersSubmitted,
							value: timestamp(document.data.createdAt, TimestampFormat.Relative),
							inline: true,
						},
					],
					footer: {
						text: guild.name,
						iconUrl: `${getGuildIconURLFormatted(
							bot,
							guild,
						)}&metadata=${`${user.id}${constants.symbols.meta.metadataSeparator}${reference}`}`,
					},
				},
			],
			components: [
				{
					type: Discord.MessageComponentTypes.ActionRow,
					components: [
						{
							type: Discord.MessageComponentTypes.Button,
							style: Discord.ButtonStyles.Success,
							label: voteInformation.acceptance.required === 1 ? strings.accept : strings.acceptMultiple,
							customId: encodeId<InteractionData>(constants.components.verification, [
								user.id.toString(),
								this.guildIdString,
								reference,
								`${true}`,
							]),
						},
						{
							type: Discord.MessageComponentTypes.Button,
							style: Discord.ButtonStyles.Danger,
							label: voteInformation.rejection.required === 1 ? strings.reject : strings.rejectMultiple,
							customId: encodeId<InteractionData>(constants.components.verification, [
								user.id.toString(),
								this.guildIdString,
								reference,
								`${false}`,
							]),
						},
					],
				},
			],
		};
	}

	async handleInteraction(
		bot: Discord.Bot,
		interaction: Discord.Interaction,
		data: InteractionData,
	): Promise<Document<EntryRequest> | null | undefined> {
		const configuration = this.configuration;
		if (configuration === undefined || !configuration.enabled) {
			return undefined;
		}

		const [userId, _, __, isAcceptString] = data;
		const isAccept = isAcceptString === "true";

		const user = await this.client.database.adapters.users.getOrFetchOrCreate(
			this.client,
			"id",
			userId,
			BigInt(userId),
		);
		if (user === undefined) {
			this.displayUserStateError(bot, interaction);
			return undefined;
		}

		const member = interaction.member;
		if (member === undefined) {
			return undefined;
		}

		const guildId = interaction.guildId;
		if (guildId === undefined) {
			return undefined;
		}

		const guild = this.client.cache.guilds.get(guildId);
		if (guild === undefined) {
			this.displayVoteError(bot, interaction);
			return undefined;
		}

		const [voter, entryRequest] = await Promise.all([
			this.client.database.adapters.users.getOrFetchOrCreate(
				this.client,
				"id",
				interaction.user.id.toString(),
				interaction.user.id,
			),
			this.client.database.adapters.entryRequests.get(this.client, "submitterAndGuild", [
				user.ref,
				this.guildIdString,
			]) as Document<EntryRequest> | undefined,
		]);
		if (voter === undefined || entryRequest === undefined) {
			this.displayVoteError(bot, interaction);
			return undefined;
		}

		const voterReferenceId = stringifyValue(voter.ref);

		const [alreadyVotedToAccept, alreadyVotedToReject] = [
			entryRequest.data.votedFor,
			entryRequest.data.votedAgainst,
		].map((voters) => voters.some((voterReference) => stringifyValue(voterReference) === voterReferenceId)) as [
			boolean,
			boolean,
		];

		const voteInformation = this.getVoteInformation(entryRequest.data);
		if (voteInformation === undefined) {
			return undefined;
		}

		const [votedFor, votedAgainst] = [[...entryRequest.data.votedFor], [...entryRequest.data.votedAgainst]];

		// If the voter has already voted to accept or to reject the user.
		if (alreadyVotedToAccept || alreadyVotedToReject) {
			// If the voter has already voted to accept, and is voting to accept again.
			if (alreadyVotedToAccept && isAccept) {
				const strings = {
					title: localise(this.client, "entry.verification.vote.alreadyVoted.inFavour.title", interaction.locale)(),
					description: localise(
						this.client,
						"entry.verification.vote.alreadyVoted.inFavour.description",
						interaction.locale,
					)(),
				};

				reply([this.client, bot], interaction, {
					embeds: [
						{
							title: strings.title,
							description: strings.description,
							color: constants.colors.dullYellow,
						},
					],
				});

				return;
				// If the voter has already voted to reject, and is voting to reject again.
			} else if (alreadyVotedToReject && !isAccept) {
				const strings = {
					title: localise(this.client, "entry.verification.vote.alreadyVoted.against.title", interaction.locale)(),
					description: localise(
						this.client,
						"entry.verification.vote.alreadyVoted.against.description",
						interaction.locale,
					)(),
				};

				reply([this.client, bot], interaction, {
					embeds: [
						{
							title: strings.title,
							description: strings.description,
							color: constants.colors.dullYellow,
						},
					],
				});

				return;
			} else {
				if (isAccept) {
					const voterIndex = votedAgainst.findIndex(
						(voterReference) => stringifyValue(voterReference) === voterReferenceId,
					);

					votedAgainst.splice(voterIndex, 1);
					votedFor.push(voter.ref);
				} else {
					const voterIndex = votedFor.findIndex(
						(voterReference) => stringifyValue(voterReference) === voterReferenceId,
					);

					votedFor.splice(voterIndex, 1);
					votedAgainst.push(voter.ref);
				}

				const strings = {
					title: localise(this.client, "entry.verification.vote.stanceChanged.title", interaction.locale)(),
					description: localise(this.client, "entry.verification.vote.stanceChanged.description", interaction.locale)(),
				};

				reply([this.client, bot], interaction, {
					embeds: [
						{
							title: strings.title,
							description: strings.description,
							color: constants.colors.lightGreen,
						},
					],
				});
			}
		} else {
			acknowledge([this.client, bot], interaction);

			if (isAccept) {
				votedFor.push(voter.ref);
			} else {
				votedAgainst.push(voter.ref);
			}
		}

		const [isAccepted, isRejected] = [
			votedFor.length >= voteInformation.acceptance.required,
			votedAgainst.length >= voteInformation.rejection.required,
		];

		const submitter = this.client.cache.users.get(BigInt(user.data.account.id));
		if (submitter === undefined) {
			return undefined;
		}

		let isFinalised = false;

		if (isAccepted || isRejected) {
			isFinalised = true;

			if (configuration.journaling) {
				const journallingService = this.client.services.journalling.get(this.guildId);

				if (isAccepted) {
					journallingService?.log(bot, "entryRequestAccept", { args: [submitter, member] });
				} else {
					journallingService?.log(bot, "entryRequestReject", { args: [submitter, member] });
				}
			}
		}

		const updatedEntryRequest = await this.client.database.adapters.entryRequests.update(this.client, {
			...entryRequest,
			data: { ...entryRequest.data, votedAgainst, votedFor, isFinalised },
		});
		if (updatedEntryRequest === undefined) {
			return undefined;
		}

		let authorisedOn = user.data.account.authorisedOn !== undefined ? [...user.data.account.authorisedOn] : undefined;
		let rejectedOn = user.data.account.rejectedOn !== undefined ? [...user.data.account.rejectedOn] : undefined;

		if (isAccepted) {
			if (authorisedOn === undefined) {
				authorisedOn = [this.guildIdString];
			} else if (!authorisedOn.includes(this.guildIdString)) {
				authorisedOn.push(this.guildIdString);
			}

			this.client.log.info(
				`Accepted ${diagnostics.display.user(user.data.account.id)} onto ${diagnostics.display.guild(guild)}.`,
			);

			Discord.addRole(
				bot,
				this.guildId,
				submitter.id,
				BigInt(entryRequest.data.requestedRole),
				"User-requested role addition.",
			).catch(() =>
				this.client.log.warn(
					`Failed to add ${diagnostics.display.role(entryRequest.data.requestedRole)} to ${diagnostics.display.user(
						user.data.account.id,
					)} on ${diagnostics.display.guild(guild)}.`,
				),
			);
		} else if (isRejected) {
			if (rejectedOn === undefined) {
				rejectedOn = [this.guildIdString];
			} else if (!rejectedOn.includes(this.guildIdString)) {
				rejectedOn.push(this.guildIdString);
			}

			this.client.log.info(
				`Rejected ${diagnostics.display.user(user.data.account.id)} from ${diagnostics.display.guild(guild)}.`,
			);

			Discord.banMember(bot, this.guildId, submitter.id, {
				reason: "Voted to reject entry request.",
			}).catch(() =>
				this.client.log.warn(
					`Failed to ban ${diagnostics.display.user(user.data.account.id)} on ${diagnostics.display.guild(guild)}.`,
				),
			);
		}

		await this.client.database.adapters.users.update(this.client, {
			...user,
			data: { ...user.data, account: { ...user.data.account, authorisedOn, rejectedOn } },
		});

		if (isAccepted || isRejected) {
			return null;
		}

		return updatedEntryRequest;
	}

	private getVoteInformation(entryRequest: EntryRequest): VoteInformation | undefined {
		const [configuration, guild] = [this.configuration, this.guild];
		if (configuration === undefined || guild === undefined) {
			return undefined;
		}

		if (!configuration.enabled) {
			return undefined;
		}

		const roleIds = guild.roles
			.filter((role) => configuration.voting.roles.includes(role.id.toString()))
			.map((role) => role.id);
		const userIds = configuration.voting.users?.map((userId) => BigInt(userId));

		const voterCount =
			guild.members
				.filter((member) => userIds?.includes(member.id) || roleIds.some((roleId) => member.roles.includes(roleId)))
				.filter((member) => !member.user?.toggles.bot)
				.array().length + 10;

		function getVoteInformation<VerdictType extends keyof VoteInformation>(
			type: VerdictType,
			configuration: Configurations["verification"] & { enabled: true },
			votes: number,
		): VoteInformation[VerdictType] {
			const verdict = configuration.voting.verdict[type];

			switch (verdict.type) {
				case "fraction": {
					const required = Math.max(1, Math.ceil(verdict.value * voterCount));
					const remaining = required - votes;
					return { required, remaining };
				}
				case "number": {
					const required = Math.max(1, verdict.value);
					const remaining = required - votes;
					return { required, remaining };
				}
			}
		}

		const acceptance = getVoteInformation("acceptance", configuration, entryRequest.votedFor.length);
		const rejection = getVoteInformation("rejection", configuration, entryRequest.votedAgainst.length);

		return { acceptance, rejection };
	}

	private async displayVoteError(bot: Discord.Bot, interaction: Discord.Interaction): Promise<void> {
		const strings = {
			title: localise(this.client, "entry.verification.vote.failed.title", interaction.locale)(),
			description: localise(this.client, "entry.verification.vote.failed.description", interaction.locale)(),
		};

		reply([this.client, bot], interaction, {
			embeds: [
				{
					title: strings.title,
					description: strings.description,
					color: constants.colors.red,
				},
			],
		});
	}

	private async displayUserStateError(bot: Discord.Bot, interaction: Discord.Interaction): Promise<void> {
		const strings = {
			title: localise(this.client, "entry.verification.vote.stateUpdateFailed.title", interaction.locale)(),
			description: localise(this.client, "entry.verification.vote.stateUpdateFailed.description", interaction.locale)(),
		};

		reply([this.client, bot], interaction, {
			embeds: [
				{
					title: strings.title,
					description: strings.description,
					color: constants.colors.red,
				},
			],
		});
	}
}

export { VerificationService };
