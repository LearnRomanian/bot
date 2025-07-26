import type { Client } from "rost/client";
import { SuggestionComposer } from "rost/commands/components/modal-composers/suggestion-composer";
import { Guild } from "rost/models/guild";
import { Suggestion } from "rost/models/suggestion";

async function handleMakeSuggestion(client: Client, interaction: Rost.Interaction): Promise<void> {
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
		await Suggestion.getAll(client, {
			where: { guildId: interaction.guildId.toString(), authorId: interaction.user.id.toString() },
		}),
		guildDocument.rateLimit("suggestions") ?? constants.defaults.SUGGESTION_RATE_LIMIT,
	);
	if (crossesRateLimit) {
		const strings = constants.contexts.tooManySuggestions({
			localise: client.localise,
			locale: interaction.locale,
		});
		client
			.pushback(interaction, {
				title: strings.title,
				description: strings.description,
			})
			.ignore();

		return;
	}

	const suggestionService = client.services.local("suggestionPrompts", { guildId: guild.id });
	if (suggestionService === undefined) {
		return;
	}

	const composer = new SuggestionComposer(client, { interaction });

	composer.onSubmit(async (submission, { formData }) => {
		await client.postponeReply(submission);

		const suggestionDocument = await Suggestion.create(client, {
			guildId: guild.id.toString(),
			authorId: interaction.user.id.toString(),
			formData,
		});

		await client.tryLog("suggestionSend", {
			guildId: guild.id,
			journalling: guildDocument.isJournalled("suggestions"),
			args: [member, suggestionDocument],
		});

		const user = client.entities.users.get(interaction.user.id);
		if (user === undefined) {
			return;
		}

		const prompt = await suggestionService.savePrompt(user, suggestionDocument);
		if (prompt === undefined) {
			return;
		}

		const strings = constants.contexts.suggestionSent({ localise: client.localise, locale: interaction.locale });
		client
			.succeeded(submission, {
				title: strings.title,
				description: strings.description,
			})
			.ignore();
	});

	await composer.open();
}

export { handleMakeSuggestion };
