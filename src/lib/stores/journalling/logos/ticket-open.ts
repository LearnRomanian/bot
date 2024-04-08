import { Client } from "logos/client";
import { Ticket } from "logos/database/ticket";
import { EventLogger } from "logos/stores/journalling/logger";

class TicketOpenEventLogger extends EventLogger<"ticketOpen"> {
	constructor(client: Client) {
		super(client, {
			title: `${constants.emojis.events.ticket} Ticket opened`,
			colour: constants.colours.husky,
		});
	}

	filter(originGuildId: bigint, member: Logos.Member, _: Ticket): boolean {
		return originGuildId === member.guildId;
	}

	buildMessage(member: Logos.Member, ticket: Ticket): string | undefined {
		const memberUser = this.client.entities.users.get(member.id);
		if (memberUser === undefined) {
			return undefined;
		}

		return `${this.client.diagnostics.user(memberUser)} has opened a ticket.\n\nTopic: *${ticket.formData.topic}*`;
	}
}

export { TicketOpenEventLogger };
