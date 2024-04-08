import { Client } from "logos/client";
import { EventLogger } from "logos/stores/journalling/logger";

class MemberTimeoutRemoveEventLogger extends EventLogger<"memberTimeoutRemove"> {
	constructor(client: Client) {
		super(client, {
			title: `${constants.emojis.events.timeout.removed} Member's timeout cleared`,
			colour: constants.colours.blue,
		});
	}

	buildMessage(member: Logos.Member, by: Logos.User): string | undefined {
		const memberUser = this.client.entities.users.get(member.id);
		if (memberUser === undefined) {
			return undefined;
		}

		return `The timeout of ${this.client.diagnostics.user(
			memberUser,
		)} has been cleared by: ${this.client.diagnostics.user(by)}`;
	}
}

export { MemberTimeoutRemoveEventLogger };
