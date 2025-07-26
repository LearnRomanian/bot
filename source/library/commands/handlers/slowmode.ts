import { timestamp } from "rost:constants/formatting";
import { getSlowmodeDelayByLevel, getSlowmodeLevelByDelay, isValidSlowmodeLevel } from "rost:constants/slowmode";
import type { Client } from "rost/client";
import { handleSimpleAutocomplete } from "rost/commands/fragments/autocomplete/simple";
import { Guild } from "rost/models/guild";

const lastUseByGuildId = new Map<bigint, number>();

async function handleToggleSlowmodeAutocomplete(
	client: Client,
	interaction: Rost.Interaction<any, { level: string }>,
): Promise<void> {
	const strings = constants.contexts.slowmodeLevel({ localise: client.localise, locale: interaction.locale });
	await handleSimpleAutocomplete(client, interaction, {
		query: interaction.parameters.level,
		elements: Object.entries(constants.slowmode.levels),
		getOption: ([_, level]) => ({ name: strings.level(level), value: level }),
	});
}

async function handleToggleSlowmode(
	client: Client,
	interaction: Rost.Interaction<any, { level: string | undefined }>,
): Promise<void> {
	if (interaction.parameters.level !== undefined && !isValidSlowmodeLevel(interaction.parameters.level)) {
		const strings = constants.contexts.invalidSlowmodeLevel({
			localise: client.localise,
			locale: interaction.locale,
		});
		client.error(interaction, { title: strings.title, description: strings.description }).ignore();

		return;
	}

	const [guild, channel] = [
		client.entities.guilds.get(interaction.guildId),
		client.entities.channels.get(interaction.channelId),
	];
	if (guild === undefined || channel === undefined) {
		return;
	}

	const guildDocument = await Guild.getOrCreate(client, { guildId: interaction.guildId.toString() });

	const isEnabled = channel.rateLimitPerUser !== undefined && channel.rateLimitPerUser !== 0;
	if (isEnabled) {
		if (interaction.parameters.level !== undefined) {
			const previousRateLimitDuration = channel.rateLimitPerUser ?? 0;
			const newRateLimitDuration = getSlowmodeDelayByLevel(interaction.parameters.level);

			const previousLevel = getSlowmodeLevelByDelay(previousRateLimitDuration) ?? "lowest";

			if (newRateLimitDuration < previousRateLimitDuration) {
				client.bot.helpers
					.editChannel(channel.id, { rateLimitPerUser: newRateLimitDuration })
					.catch((error) =>
						client.log.warn(
							error,
							`Failed to downgrade slowmode level on ${client.diagnostics.channel(channel)}.`,
						),
					);

				await client.tryLog("slowmodeDowngrade", {
					guildId: guild.id,
					journalling: guildDocument.isJournalled("slowmode"),
					args: [interaction.user, channel, previousLevel, interaction.parameters.level],
				});

				const strings = constants.contexts.slowmodeDowngraded({
					localise: client.localise,
					locale: interaction.guildLocale,
				});
				client
					.success(
						interaction,
						{
							title: `${constants.emojis.events.slowmode.downgraded}  ${strings.title}`,
							description: strings.description,
						},
						{ visible: true },
					)
					.ignore();

				return;
			}

			if (newRateLimitDuration > previousRateLimitDuration) {
				client.bot.helpers
					.editChannel(channel.id, { rateLimitPerUser: newRateLimitDuration })
					.catch((error) =>
						client.log.warn(
							error,
							`Failed to upgrade slowmode level on ${client.diagnostics.channel(channel)}.`,
						),
					);

				await client.tryLog("slowmodeUpgrade", {
					guildId: guild.id,
					journalling: guildDocument.isJournalled("slowmode"),
					args: [interaction.user, channel, previousLevel, interaction.parameters.level],
				});

				const strings = constants.contexts.slowmodeUpgraded({
					localise: client.localise,
					locale: interaction.guildLocale,
				});
				client
					.success(
						interaction,
						{
							title: `${constants.emojis.events.slowmode.upgraded}  ${strings.title}`,
							description: strings.description,
						},
						{ visible: true },
					)
					.ignore();

				return;
			}

			{
				const strings = constants.contexts.theSameSlowmodeLevel({
					localise: client.localise,
					locale: interaction.locale,
				});
				client
					.warning(interaction, {
						title: strings.title,
						description: `${strings.description.theSame}\n\n${strings.description.chooseDifferent}`,
					})
					.ignore();
			}

			return;
		}

		const lastUse = lastUseByGuildId.get(interaction.guildId);
		if (lastUse !== undefined) {
			const now = Date.now();
			const timeElapsedSinceUse = now - lastUse;
			if (timeElapsedSinceUse < constants.SLOWMODE_COLLISION_TIMEOUT) {
				const canDisableIn = now + (constants.SLOWMODE_COLLISION_TIMEOUT - timeElapsedSinceUse);

				const strings = constants.contexts.slowmodeTooSoon({
					localise: client.localise,
					locale: interaction.locale,
				});
				client
					.pushback(interaction, {
						title: strings.title,
						description: `${strings.description.justEnabled} ${strings.description.canDisableIn({
							relative_timestamp: timestamp(canDisableIn, { format: "relative" }),
						})}`,
					})
					.ignore();

				return;
			}
		}

		client.bot.helpers
			.editChannel(channel.id, { rateLimitPerUser: null })
			.catch((error) =>
				client.log.warn(error, `Failed to disable slowmode on ${client.diagnostics.channel(channel)}.`),
			);

		await client.tryLog("slowmodeDisable", {
			guildId: guild.id,
			journalling: guildDocument.isJournalled("slowmode"),
			args: [interaction.user, channel],
		});

		const strings = constants.contexts.slowmodeDisabled({
			localise: client.localise,
			locale: interaction.guildLocale,
		});
		client
			.notice(
				interaction,
				{
					title: `${constants.emojis.events.slowmode.disabled}  ${strings.title}`,
					description: strings.description,
				},
				{ visible: true },
			)
			.ignore();

		return;
	}

	lastUseByGuildId.set(guild.id, Date.now());

	client.bot.helpers
		.editChannel(channel.id, {
			rateLimitPerUser: getSlowmodeDelayByLevel(interaction.parameters.level ?? "lowest"),
		})
		.catch((error) =>
			client.log.warn(error, `Failed to enable slowmode on ${client.diagnostics.channel(channel)}.`),
		);

	await client.tryLog("slowmodeEnable", {
		guildId: guild.id,
		journalling: guildDocument.isJournalled("slowmode"),
		args: [interaction.user, channel, interaction.parameters.level ?? "lowest"],
	});

	const strings = constants.contexts.slowmodeEnabled({ localise: client.localise, locale: interaction.guildLocale });
	client
		.notice(
			interaction,
			{
				title: `${constants.emojis.events.slowmode.enabled}  ${strings.title}`,
				description: strings.description,
			},
			{ visible: true },
		)
		.ignore();
}

export { handleToggleSlowmode, handleToggleSlowmodeAutocomplete };
