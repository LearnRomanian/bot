import type { Client } from "rost/client";
import { TicketComposer } from "rost/commands/components/modal-composers/ticket-composer";
import { Guild } from "rost/models/guild";
import { Ticket } from "rost/models/ticket";

async function handleOpenTicket(client: Client, interaction: Rost.Interaction): Promise<void> {
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
		await Ticket.getAll(client, {
			where: { guildId: interaction.guildId.toString(), authorId: interaction.user.id.toString() },
		}),
		guildDocument.rateLimit("tickets") ?? constants.defaults.TICKET_RATE_LIMIT,
	);
	if (crossesRateLimit) {
		const strings = constants.contexts.tooManyTickets({
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

	const composer = new TicketComposer(client, { interaction });

	composer.onSubmit(async (submission, { formData }) => {
		await client.postponeReply(submission);

		const ticketDocument = await client.services
			.local("ticketPrompts", { guildId: interaction.guildId })
			.openTicket({
				type: "standalone",
				formData,
				user: submission.user,
			});
		if (ticketDocument === undefined) {
			return;
		}

		const strings = constants.contexts.ticketSent({ localise: client.localise, locale: submission.locale });
		client.succeeded(submission, { title: strings.title, description: strings.description }).ignore();
	});

	await composer.open();
}

export { handleOpenTicket };
