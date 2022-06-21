import { Availability } from '../../../commands/structs/availability.ts';
import { Command } from '../../../commands/structs/command.ts';
import { user } from '../../parameters.ts';
import { reason } from '../parameters.ts';

const command: Command = {
	name: 'reprimand',
	availability: Availability.MODERATORS,
	description: 'Reprimands the user.',
	options: [user, reason],
};

export default command;
