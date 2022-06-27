import { Interaction } from '../../../../deps.ts';
import { Client } from '../../../client.ts';
import { Availability } from '../../../commands/structs/availability.ts';
import { Command } from '../../../commands/structs/command.ts';
import configuration from '../../../configuration.ts';

const command: Command = {
	name: 'unpause',
	availability: Availability.MEMBERS,
	description: 'Unpauses the currently playing song.',
	handle: unpause,
};

async function unpause(
	client: Client,
	interaction: Interaction,
): Promise<void> {
	const controller = client.music.get(interaction.guild!.id)!;

	const [canAct, _] = await controller.verifyMemberVoiceState(interaction);
	if (!canAct) return;

	if (!controller.isOccupied) {
		interaction.respond({
			ephemeral: true,
			embeds: [{
				title: 'Nothing to unpause',
				description: 'There is no song to unpause.',
				color: configuration.interactions.responses.colors.yellow,
			}],
		});
		return;
	}

	if (!controller.isPaused) {
		interaction.respond({
			ephemeral: true,
			embeds: [{
				title: 'Not paused',
				description: 'The current song is not paused.',
				color: configuration.interactions.responses.colors.yellow,
			}],
		});
		return;
	}

	controller.unpause();

	interaction.respond({
		embeds: [{
			title: '▶️ Unpaused',
			description: 'The current song has been unpaused.',
			color: configuration.interactions.responses.colors.invisible,
		}],
	});
}

export default command;
