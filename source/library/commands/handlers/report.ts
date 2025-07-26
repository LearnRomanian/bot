import type { Client } from "rost/client";
import { ReportComposer } from "rost/commands/components/modal-composers/report-composer";
import { Guild } from "rost/models/guild";
import { Report } from "rost/models/report";

async function handleMakeReport(client: Client, interaction: Rost.Interaction): Promise<void> {
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
		await Report.getAll(client, {
			where: { guildId: interaction.guildId.toString(), authorId: interaction.user.id.toString() },
		}),
		guildDocument.rateLimit("reports") ?? constants.defaults.REPORT_RATE_LIMIT,
	);
	if (crossesRateLimit) {
		const strings = constants.contexts.tooManyReports({ localise: client.localise, locale: interaction.locale });
		client.warning(interaction, { title: strings.title, description: strings.description }).ignore();

		return;
	}

	const composer = new ReportComposer(client, { interaction });

	composer.onSubmit(async (submission, { formData }) => {
		await client.postponeReply(submission);

		const reportDocument = await Report.create(client, {
			guildId: guild.id.toString(),
			authorId: interaction.user.id.toString(),
			formData,
		});

		await client.tryLog("reportSubmit", {
			guildId: guild.id,
			journalling: guildDocument.isJournalled("reports"),
			args: [member, reportDocument],
		});

		const user = client.entities.users.get(interaction.user.id);
		if (user === undefined) {
			return;
		}

		const prompt = await client.services
			.local("reportPrompts", { guildId: interaction.guildId })
			.savePrompt(user, reportDocument);
		if (prompt === undefined) {
			return;
		}

		const strings = constants.contexts.reportSubmitted({ localise: client.localise, locale: interaction.locale });
		client
			.succeeded(submission, {
				title: strings.title,
				description: strings.description,
			})
			.ignore();
	});

	await composer.open();
}

export { handleMakeReport };
