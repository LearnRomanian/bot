import diagnostics from "../../../diagnostics";
import { Client } from "../../client";
import { Resource } from "../../database/resource";
import { EventLogger } from "../logger";

class ResourceSendEventLogger extends EventLogger<"resourceSend"> {
	constructor(client: Client) {
		super(client, {
			title: `${constants.emojis.events.resource} Resource submitted`,
			colour: constants.colours.darkGreen,
		});
	}

	filter(originGuildId: bigint, member: Logos.Member, _: Resource): boolean {
		return originGuildId === member.guildId;
	}

	buildMessage(member: Logos.Member, resource: Resource): string | undefined {
		const memberUser = this.client.entities.users.get(member.id);
		if (memberUser === undefined) {
			return undefined;
		}

		return `${diagnostics.display.user(memberUser)} has submitted a resource.\n\nResource: *${
			resource.answers.resource
		}*`;
	}
}

export { ResourceSendEventLogger };
