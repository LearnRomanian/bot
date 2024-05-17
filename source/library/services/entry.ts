import { timeStructToMilliseconds } from "logos:constants/time";
import { code } from "logos:core/formatting";
import type { Client } from "logos/client";
import { InteractionCollector } from "logos/collectors";
import { EntryRequestComposer } from "logos/commands/components/modal-composers/entry-request-composer";
import { EntryRequest } from "logos/database/entry-request";
import type { Guild } from "logos/database/guild";
import { User } from "logos/database/user";
import { LocalService } from "logos/services/service";

class EntryService extends LocalService {
	readonly #_acceptedRulesButton: InteractionCollector;

	get configuration(): NonNullable<Guild["entry"]> {
		return this.guildDocument.entry!;
	}

	get verificationConfiguration(): NonNullable<Guild["verification"]> {
		return this.guildDocument.verification!;
	}

	constructor(client: Client, { guildId }: { guildId: bigint }) {
		super(client, { identifier: "EntryService", guildId });

		this.#_acceptedRulesButton = new InteractionCollector(client, {
			guildId,
			customId: constants.components.acceptedRules,
			isPermanent: true,
		});
	}

	async start(): Promise<void> {
		this.#_acceptedRulesButton.onInteraction(this.#handleAcceptRules.bind(this));

		await this.client.registerInteractionCollector(this.#_acceptedRulesButton);
	}

	async stop(): Promise<void> {
		await this.#_acceptedRulesButton.close();
	}

	async #handleAcceptRules(buttonPress: Logos.Interaction): Promise<void> {
		const languageProficiencyButtons = new InteractionCollector<[index: string]>(this.client, {
			only: [buttonPress.user.id],
			dependsOn: this.#_acceptedRulesButton,
		});

		languageProficiencyButtons.onInteraction((buttonPress) =>
			this.#handlePickLanguageProficiency(buttonPress, { collector: languageProficiencyButtons }),
		);

		await this.client.registerInteractionCollector(languageProficiencyButtons);

		const strings = constants.contexts.chooseProficiency({
			localise: this.client.localise.bind(this.client),
			locale: buttonPress.locale,
		});
		await this.client.notice(buttonPress, {
			embeds: [
				{
					title: strings.title,
					description: `${strings.description.chooseProficiency({
						language: buttonPress.featureLanguage,
					})}\n\n${strings.description.canChangeLater({
						command: code(
							this.client.localiseCommand(
								// @ts-ignore: This is fine for now.
								this.client.commands.profile.options.roles.key,
								buttonPress.locale,
							),
						),
					})}`,
				},
			],
			components: [
				{
					type: Discord.MessageComponentTypes.ActionRow,
					components: Object.values(
						constants.roles.language.categories.proficiency.collection.list,
					).map<Discord.ButtonComponent>((proficiencyRole, index) => {
						const strings = constants.contexts.role({
							localise: this.client.localise.bind(this.client),
							locale: buttonPress.locale,
						});
						return {
							type: Discord.MessageComponentTypes.Button,
							label: strings.name({ id: proficiencyRole.id }),
							customId: languageProficiencyButtons.encodeId([index.toString()]),
							style: Discord.ButtonStyles.Secondary,
							emoji: { name: proficiencyRole.emoji },
						};
					}) as [Discord.ButtonComponent],
				},
			],
		});
	}

	async #handlePickLanguageProficiency(
		buttonPress: Logos.Interaction<[index: string]>,
		{ collector }: { collector: InteractionCollector<[index: string]> },
	): Promise<void> {
		const index = Number.parseInt(buttonPress.metadata[1]);
		const snowflake = (
			Object.values(constants.roles.language.categories.proficiency.collection.list)[index]?.snowflakes as
				| Record<string, string>
				| undefined
		)?.[this.guildIdString];
		if (snowflake === undefined) {
			return;
		}

		const roleId = BigInt(snowflake);
		const role = this.guild.roles.get(roleId);
		if (role === undefined) {
			return;
		}

		const canEnter = await this.#vetUser(buttonPress);
		if (!canEnter) {
			return;
		}

		const requiresVerification = this.#requiresVerification(buttonPress.user);
		if (requiresVerification === undefined) {
			return;
		}

		if (requiresVerification) {
			const userDocument = await User.getOrCreate(this.client, { userId: buttonPress.user.id.toString() });

			const requestVerificationButton = new InteractionCollector<[index: string]>(this.client, {
				only: [buttonPress.user.id],
				dependsOn: collector,
				isSingle: true,
			});

			requestVerificationButton.onInteraction(this.#handleRequestVerification.bind(this));

			await this.client.registerInteractionCollector(requestVerificationButton);

			const isVerified = userDocument.isAuthorisedOn({ guildId: this.guildIdString });
			if (!isVerified) {
				const strings = constants.contexts.getVerified({
					localise: this.client.localise.bind(this.client),
					locale: buttonPress.locale,
				});
				await this.client.notice(buttonPress, {
					embeds: [
						{
							title: strings.title,
							description: `${strings.description.verificationRequired({
								server_name: this.guild.name,
							})}\n\n${strings.description.honestAnswers}`,
						},
					],
					components: [
						{
							type: Discord.MessageComponentTypes.ActionRow,
							components: [
								{
									type: Discord.MessageComponentTypes.Button,
									style: Discord.ButtonStyles.Secondary,
									label: strings.description.understood,
									customId: requestVerificationButton.encodeId([buttonPress.metadata[1]]),
									emoji: { name: constants.emojis.understood },
								},
							],
						},
					],
				});

				return;
			}
		}

		const strings = constants.contexts.receivedAccess({
			localise: this.client.localise.bind(this.client),
			locale: buttonPress.locale,
		});
		await this.client.success(buttonPress, {
			title: strings.title,
			description: `${constants.emojis.responses.celebration} ${strings.description.nowMember({
				server_name: this.guild.name,
			})}\n\n${strings.description.toStart}`,
			image: { url: constants.gifs.welcome },
		});

		this.client.bot.helpers
			.addRole(this.guild.id, buttonPress.user.id, role.id, "User-requested role addition.")
			.catch(() =>
				this.log.warn(
					`Failed to add ${this.client.diagnostics.role(role)} to ${this.client.diagnostics.user(
						buttonPress.user,
					)} on ${this.client.diagnostics.guild(this.guild.id)}.`,
				),
			);
	}

	async #handleRequestVerification(buttonPress: Logos.Interaction<[index: string]>): Promise<void> {
		const index = Number.parseInt(buttonPress.metadata[1]);
		const snowflake = (
			Object.values(constants.roles.language.categories.proficiency.collection.list)[index]?.snowflakes as
				| Record<string, string>
				| undefined
		)?.[this.guildIdString];
		if (snowflake === undefined) {
			return;
		}

		const requestedRoleId = BigInt(snowflake);

		const entryRequestDocument = await EntryRequest.get(this.client, {
			guildId: this.guildId.toString(),
			authorId: buttonPress.user.id.toString(),
		});

		if (entryRequestDocument !== undefined) {
			const strings = constants.contexts.alreadyAnswered({
				localise: this.client.localise.bind(this.client),
				locale: buttonPress.locale,
			});
			await this.client.pushback(buttonPress, {
				title: strings.title,
				description: strings.description,
			});

			return;
		}

		const verificationService = this.client.getPromptService(this.guildId, { type: "verification" });
		if (verificationService === undefined) {
			return;
		}

		const entryRequest = await EntryRequest.get(this.client, {
			guildId: this.guild.id.toString(),
			authorId: buttonPress.user.id.toString(),
		});

		const composer = new EntryRequestComposer(this.client, { interaction: buttonPress });

		composer.onSubmit(async (submission, { formData }) => {
			if (entryRequest !== undefined) {
				const strings = constants.contexts.alreadyAnswered({
					localise: this.client.localise.bind(this.client),
					locale: submission.locale,
				});
				await this.client.pushback(submission, {
					title: strings.title,
					description: strings.description,
				});

				return;
			}

			await this.client.postponeReply(submission);

			const entryRequestDocument = await EntryRequest.create(this.client, {
				guildId: this.guild.id.toString(),
				authorId: buttonPress.user.id.toString(),
				requestedRoleId: requestedRoleId.toString(),
				formData,
			});

			await this.client.tryLog("entryRequestSubmit", {
				guildId: this.guild.id,
				args: [buttonPress.user, entryRequestDocument],
			});

			const user = this.client.entities.users.get(buttonPress.user.id);
			if (user === undefined) {
				return;
			}

			const prompt = await verificationService.savePrompt(user, entryRequestDocument);
			if (prompt === undefined) {
				return;
			}

			verificationService.registerDocument(entryRequestDocument);
			verificationService.registerPrompt(prompt, buttonPress.user.id, entryRequestDocument);
			verificationService.registerHandler(entryRequestDocument);

			const strings = constants.contexts.verificationAnswersSubmitted({
				localise: this.client.localise.bind(this.client),
				locale: submission.locale,
			});
			await this.client.succeeded(submission, {
				title: strings.title,
				description: `${strings.description.submitted}\n\n${strings.description.willBeReviewed}`,
			});
		});

		await composer.open();
	}

	async #vetUser(interaction: Logos.Interaction): Promise<boolean> {
		const [userDocument, entryRequestDocument] = await Promise.all([
			User.getOrCreate(this.client, { userId: interaction.user.id.toString() }),
			EntryRequest.get(this.client, { guildId: this.guildIdString, authorId: interaction.user.id.toString() }),
		]);

		if (entryRequestDocument !== undefined && !entryRequestDocument.isFinalised) {
			const strings = constants.contexts.alreadyAnswered({
				localise: this.client.localise.bind(this.client),
				locale: interaction.locale,
			});
			await this.client.pushback(interaction, {
				title: strings.title,
				description: strings.description,
			});

			return false;
		}

		if (userDocument.isAuthorisedOn({ guildId: this.guildIdString })) {
			return true;
		}

		if (userDocument.isRejectedOn({ guildId: this.guildIdString })) {
			const strings = constants.contexts.rejectedBefore({
				localise: this.client.localise.bind(this.client),
				locale: interaction.locale,
			});
			await this.client.error(interaction, {
				title: strings.title,
				description: strings.description,
			});

			return false;
		}

		return true;
	}

	#requiresVerification(user: Logos.User): boolean | undefined {
		const verificationConfiguration = this.verificationConfiguration;
		if (verificationConfiguration === undefined) {
			return undefined;
		}

		for (const rule of verificationConfiguration.activation) {
			switch (rule.type) {
				case "account-age": {
					const createdAt = Discord.snowflakeToTimestamp(user.id);
					const age = Date.now() - createdAt;

					if (age < timeStructToMilliseconds(rule.value)) {
						return true;
					}

					break;
				}
			}
		}

		return false;
	}
}

export { EntryService };
