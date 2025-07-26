import { mention } from "rost:constants/formatting";
import { isValidRule } from "rost:constants/rules";
import { timeStructToMilliseconds } from "rost:constants/time";
import type { Client } from "rost/client";
import { getRuleTitleFormatted } from "rost/commands/rules";
import { Guild } from "rost/models/guild";
import { Warning } from "rost/models/warning";

async function handleWarnUserAutocomplete(
	client: Client,
	interaction: Rost.Interaction<any, { user: string; rule: string; reason: string }>,
): Promise<void> {
	if (interaction.parameters.focused === undefined) {
		return;
	}

	switch (interaction.parameters.focused) {
		case "user": {
			await client.autocompleteMembers(interaction, {
				identifier: interaction.parameters.user,
				options: {
					restrictToNonSelf: true,
					excludeModerators: true,
				},
			});
			break;
		}
		case "rule": {
			const strings = constants.contexts.otherRuleOption({
				localise: client.localise,
				locale: interaction.locale,
			});
			const ruleLowercase = interaction.parameters.rule.trim().toLowerCase();
			const choices = [
				...constants.rules
					.map((rule) => {
						return {
							name: getRuleTitleFormatted(client, interaction, { rule, mode: "option" }),
							value: rule,
						};
					})
					.filter((choice) => choice.name.toLowerCase().includes(ruleLowercase)),
				{ name: strings.option, value: constants.components.none },
			];
			client.respond(interaction, choices).ignore();

			break;
		}
	}
}

async function handleWarnUser(
	client: Client,
	interaction: Rost.Interaction<any, { user: string; rule: string; reason: string }>,
): Promise<void> {
	const guildDocument = await Guild.getOrCreate(client, { guildId: interaction.guildId.toString() });
	const configuration = guildDocument.feature("warns");

	if (interaction.parameters.rule !== constants.components.none && !isValidRule(interaction.parameters.rule)) {
		const strings = constants.contexts.invalidRule({ localise: client.localise, locale: interaction.locale });
		client.error(interaction, { title: strings.title, description: strings.description }).ignore();

		return;
	}

	const member = client.resolveInteractionToMember(interaction, {
		identifier: interaction.parameters.user,
		options: {
			restrictToNonSelf: true,
			excludeModerators: true,
		},
	});
	if (member === undefined) {
		return;
	}

	const user = member.user;
	if (user === undefined) {
		return;
	}

	const guild = client.entities.guilds.get(interaction.guildId);
	if (guild === undefined) {
		return;
	}

	const moderatorRoleIds = guild.roles
		.array()
		.filter((role) => role.permissions.has("MODERATE_MEMBERS"))
		.map((role) => role.id);
	if (moderatorRoleIds.length === 0) {
		return undefined;
	}

	const warningDocument = await Warning.create(client, {
		guildId: interaction.guildId.toString(),
		authorId: interaction.user.id.toString(),
		targetId: member.id.toString(),
		reason: interaction.parameters.reason,
		rule: interaction.parameters.rule === constants.components.none ? undefined : interaction.parameters.rule,
	});

	await client.tryLog("memberWarnAdd", {
		guildId: guild.id,
		journalling: guildDocument.isJournalled("warns"),
		args: [member, warningDocument, interaction.user],
	});

	const warningDocumentsActive = await Warning.getActiveWarnings(client, {
		guildId: interaction.guildId.toString(),
		targetId: member.id.toString(),
		timeRangeMilliseconds: timeStructToMilliseconds(configuration.expiration ?? constants.defaults.WARN_EXPIRY),
	});

	const strings = constants.contexts.userWarned({ localise: client.localise, locale: interaction.locale });
	client
		.success(interaction, {
			title: strings.title,
			description: strings.description({
				user_mention: mention(member.id, { type: "user" }),
				warnings: client.pluralise("warn.strings.warned.description.warnings", interaction.locale, {
					quantity: warningDocumentsActive.length,
				}),
			}),
		})
		.ignore();

	const surpassedLimit = warningDocumentsActive.length > configuration.limit;
	if (surpassedLimit) {
		if (guildDocument.hasEnabled("alerts")) {
			if (configuration.autoTimeout !== undefined) {
				const timeout = configuration.autoTimeout.duration ?? constants.defaults.WARN_TIMEOUT;
				const timeoutMilliseconds = timeStructToMilliseconds(timeout);

				client.bot.helpers
					.editMember(guild.id, member.id, {
						communicationDisabledUntil: new Date(Date.now() + timeoutMilliseconds).toISOString(),
					})
					.catch((error) =>
						client.log.warn(error, `Failed to edit timeout state of ${client.diagnostics.member(member)}.`),
					);

				const strings = constants.contexts.warningLimitSurpassedAndTimedOut({
					localise: client.localise,
					locale: interaction.guildLocale,
				});
				await client.services.local("alerts", { guildId: interaction.guildId }).alert({
					embeds: [
						{
							title: strings.title,
							description: strings.description({
								user_mention: mention(user.id, { type: "user" }),
								limit: configuration.limit,
								number: warningDocumentsActive.length,
								period: client.pluralise(`units.${timeout[1]}.word`, interaction.guildLocale, {
									quantity: timeout[0],
								}),
							}),
							color: constants.colours.red,
						},
					],
				});
			} else {
				const strings = constants.contexts.warningLimitSurpassed({
					localise: client.localise,
					locale: interaction.guildLocale,
				});
				await client.services.local("alerts", { guildId: interaction.guildId }).alert({
					embeds: [
						{
							title: strings.title,
							description: strings.description({
								user_mention: mention(user.id, { type: "user" }),
								limit: configuration.limit,
								number: warningDocumentsActive.length,
							}),
							color: constants.colours.red,
						},
					],
				});
			}
		}

		return;
	}

	const reachedLimit = warningDocumentsActive.length === constants.defaults.WARN_LIMIT;
	if (reachedLimit) {
		const strings = constants.contexts.limitReached({ localise: client.localise, locale: interaction.guildLocale });
		if (guildDocument.hasEnabled("alerts")) {
			await client.services.local("alerts", { guildId: interaction.guildId }).alert({
				embeds: [
					{
						title: strings.title,
						description: strings.description({
							user_mention: mention(user.id, { type: "user" }),
							limit: constants.defaults.WARN_LIMIT,
						}),
						color: constants.colours.yellow,
					},
				],
			});
		}
	}
}

export { handleWarnUser, handleWarnUserAutocomplete };
