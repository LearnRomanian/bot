import * as Discord from "@discordeno/bot";
import constants from "../../../../../../constants/constants";
import { Locale } from "../../../../../../constants/languages";
import * as Logos from "../../../../../../types";
import { Client } from "../../../../../client";
import { Praise } from "../../../../../database/praise";
import { User } from "../../../../../database/user";
import { parseArguments } from "../../../../../interactions";
import { OptionTemplate } from "../../../../command";
import { user } from "../../../../parameters";
import { getPraisePage } from "../praises";

const option: OptionTemplate = {
	id: "author",
	type: Discord.ApplicationCommandOptionTypes.SubCommand,
	handle: handleDisplayPraises,
	handleAutocomplete: handleDisplayPraisesAutocomplete,
	options: [{ ...user, required: false }],
};

async function handleDisplayPraisesAutocomplete(client: Client, interaction: Logos.Interaction): Promise<void> {
	const [{ user }] = parseArguments(interaction.data?.options, {});
	if (user === undefined) {
		return;
	}

	client.autocompleteMembers(interaction, { identifier: user });
}

async function handleDisplayPraises(client: Client, interaction: Logos.Interaction): Promise<void> {
	const locale = interaction.locale;

	const [{ user: userQuery }] = parseArguments(interaction.data?.options, {});

	const member = client.resolveInteractionToMember(
		interaction,
		{ identifier: userQuery ?? interaction.user.id.toString() },
		{ locale },
	);
	if (member === undefined) {
		return;
	}

	const user = member.user;
	if (user === undefined) {
		return;
	}

	const isSelf = member.id === interaction.user.id;

	let session = client.database.openSession();

	const userDocument =
		client.documents.users.get(member.id.toString()) ??
		(await session.get<User>(`users/${member.id}`).then((value) => value ?? undefined)) ??
		(await (async () => {
			const userDocument = {
				...({
					id: `users/${member.id}`,
					account: { id: member.id.toString() },
					createdAt: Date.now(),
				} satisfies User),
				"@metadata": { "@collection": "Users" },
			};
			await session.set(userDocument);
			await session.saveChanges();

			return userDocument as User;
		})());

	session.dispose();

	if (userDocument === undefined) {
		displayError(client, interaction, { locale });
		return;
	}

	session = client.database.openSession();

	const praisesDocumentsCached = client.documents.praisesByAuthor.get(member.id.toString());
	const praiseDocuments =
		praisesDocumentsCached !== undefined
			? Array.from(praisesDocumentsCached.values())
			: await session
					.query<Praise>({ collection: "Praises" })
					.whereRegex("id", `^praises/\\d+/${interaction.user.id}/\\d+$`)
					.all()
					.then((documents) => {
						const map = new Map(
							documents.map((document) => [
								`${document.targetId}/${document.authorId}/${document.createdAt}`,
								document,
							]),
						);
						client.documents.praisesByAuthor.set(member.id.toString(), map);
						return documents;
					});

	session.dispose();

	client.reply(interaction, {
		embeds: [getPraisePage(client, praiseDocuments, isSelf, "author", { locale })],
	});
}

async function displayError(
	client: Client,
	interaction: Logos.Interaction,
	{ locale }: { locale: Locale },
): Promise<void> {
	const strings = {
		title: client.localise("list.options.praises.strings.failed.title", locale)(),
		description: client.localise("list.options.praises.strings.failed.description", locale)(),
	};

	client.reply(interaction, {
		embeds: [
			{
				title: strings.title,
				description: strings.description,
				color: constants.colors.red,
			},
		],
	});
}

export default option;
