import type { Client } from "rost/client";
import { ResourceComposer } from "rost/commands/components/modal-composers/resource-composer";
import { Guild } from "rost/models/guild";
import { Resource } from "rost/models/resource";

async function handleSubmitResource(client: Client, interaction: Rost.Interaction): Promise<void> {
	const guildDocument = await Guild.getOrCreate(client, { guildId: interaction.guildId.toString() });

	const guild = client.entities.guilds.get(interaction.guildId);
	if (guild === undefined) {
		return;
	}

	const member = interaction.member;
	if (member === undefined) {
		return;
	}

	const crossesRateLimit = Guild.crossesRateLimit(
		await Resource.getAll(client, {
			where: { guildId: interaction.guildId.toString(), authorId: interaction.user.id.toString() },
		}),
		guildDocument.rateLimit("resourceSubmissions") ?? constants.defaults.RESOURCE_RATE_LIMIT,
	);
	if (crossesRateLimit) {
		const strings = constants.contexts.tooManyResources({ localise: client.localise, locale: interaction.locale });
		client.warning(interaction, { title: strings.title, description: strings.description }).ignore();

		return;
	}

	const composer = new ResourceComposer(client, { interaction });

	composer.onSubmit(async (submission, { formData }) => {
		await client.postponeReply(submission);

		const resourceDocument = await Resource.create(client, {
			guildId: guild.id.toString(),
			authorId: interaction.user.id.toString(),
			formData,
		});

		await client.tryLog("resourceSend", {
			guildId: guild.id,
			journalling: guildDocument.isJournalled("resourceSubmissions"),
			args: [member, resourceDocument],
		});

		const user = client.entities.users.get(interaction.user.id);
		if (user === undefined) {
			return;
		}

		const prompt = await client.services
			.local("resourcePrompts", { guildId: interaction.guildId })
			.savePrompt(user, resourceDocument);
		if (prompt === undefined) {
			return;
		}

		const strings = constants.contexts.resourceSent({ localise: client.localise, locale: interaction.locale });
		client
			.succeeded(submission, {
				title: strings.title,
				description: strings.description,
			})
			.ignore();
	});

	await composer.open();
}

export { handleSubmitResource };
