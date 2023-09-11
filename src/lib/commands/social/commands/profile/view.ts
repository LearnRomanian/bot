import * as Discord from "@discordeno/bot";
import constants from "../../../../../constants/constants";
import { Locale } from "../../../../../constants/languages";
import { MentionTypes, mention } from "../../../../../formatting";
import * as Logos from "../../../../../types";
import { Client, autocompleteMembers, localise, resolveInteractionToMember } from "../../../../client";
import { parseArguments, reply } from "../../../../interactions";
import { OptionTemplate } from "../../../command";
import { show, user } from "../../../parameters";

const command: OptionTemplate = {
	name: "view",
	type: Discord.ApplicationCommandOptionTypes.SubCommand,
	isShowable: true,
	handle: handleDisplayProfile,
	handleAutocomplete: handleDisplayProfileAutocomplete,
	options: [{ ...user, required: false }, show],
};

async function handleDisplayProfileAutocomplete(
	[client, bot]: [Client, Discord.Bot],
	interaction: Logos.Interaction,
): Promise<void> {
	const [{ user }] = parseArguments(interaction.data?.options, {});
	if (user === undefined) {
		return;
	}

	autocompleteMembers([client, bot], interaction, user);
}

async function handleDisplayProfile(
	[client, bot]: [Client, Discord.Bot],
	interaction: Logos.Interaction,
): Promise<void> {
	const [{ user, show }] = parseArguments(interaction.data?.options, { show: "boolean" });
	const locale = show ? interaction.guildLocale : interaction.locale;

	const member = resolveInteractionToMember(
		[client, bot],
		interaction,
		user ?? interaction.user.id.toString(),
		{},
		{ locale },
	);
	if (member === undefined) {
		return;
	}

	const target = member.user;
	if (target === undefined) {
		return;
	}

	const subject = await client.database.adapters.users.getOrFetchOrCreate(
		client,
		"id",
		member.id.toString(),
		member.id,
	);
	if (subject === undefined) {
		const locale = interaction.locale;
		displayError([client, bot], interaction, { locale });
		return;
	}

	const [praisesSent, praisesReceived, warningsReceived] = await Promise.all([
		client.database.adapters.praises.getOrFetch(client, "sender", subject.ref),
		client.database.adapters.praises.getOrFetch(client, "recipient", subject.ref),
		client.database.adapters.warnings.getOrFetch(client, "recipient", subject.ref),
	]);
	if (praisesSent === undefined || praisesReceived === undefined || warningsReceived === undefined) {
		const locale = interaction.locale;
		displayError([client, bot], interaction, { locale });
		return;
	}

	const strings = {
		title: localise(
			client,
			"profile.options.view.strings.information.title",
			locale,
		)({
			username: target.username,
		}),
		roles: localise(client, "profile.options.view.strings.information.description.roles", locale)(),
		statistics: localise(client, "profile.options.view.strings.information.description.statistics", locale)(),
		praises: localise(client, "profile.options.view.strings.information.description.praises", locale)(),
		warnings: localise(client, "profile.options.view.strings.information.description.warnings", locale)(),
		received: localise(client, "profile.options.view.strings.information.description.received", locale)(),
		sent: localise(client, "profile.options.view.strings.information.description.sent", locale)(),
	};

	reply(
		[client, bot],
		interaction,
		{
			embeds: [
				{
					title: strings.title,
					thumbnail: (() => {
						const iconURL = Discord.avatarUrl(target.id, target.discriminator, {
							avatar: target.avatar,
							size: 4096,
							format: "webp",
						});
						if (iconURL === undefined) {
							return;
						}

						return { url: iconURL };
					})(),
					color: constants.colors.peach,
					fields: [
						{
							name: `${constants.symbols.profile.roles} ${strings.roles}`,
							value: member.roles.map((roleId) => mention(roleId, MentionTypes.Role)).join(" "),
							inline: false,
						},
						{
							name: `${constants.symbols.profile.statistics.statistics} ${strings.statistics}`,
							value: `${constants.symbols.profile.statistics.praises} ${strings.praises} • ${strings.received} – ${praisesReceived.size} • ${strings.sent} – ${praisesSent.size}
  ${constants.symbols.profile.statistics.warnings} ${strings.warnings} • ${strings.received} – ${warningsReceived.size}`,
							inline: false,
						},
					],
				},
			],
		},
		{ visible: show },
	);
}

async function displayError(
	[client, bot]: [Client, Discord.Bot],
	interaction: Logos.Interaction,
	{ locale }: { locale: Locale },
): Promise<void> {
	const strings = {
		title: localise(client, "profile.options.view.strings.failed.title", locale)(),
		description: localise(client, "profile.options.view.strings.failed.description", locale)(),
	};

	reply([client, bot], interaction, {
		embeds: [
			{
				title: strings.title,
				description: strings.description,
				color: constants.colors.red,
			},
		],
	});
}

export default command;
