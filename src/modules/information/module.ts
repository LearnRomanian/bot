import { Command } from '../../commands/structs/command.ts';
import information from './commands/information.ts';

const commands: Record<string, Command> = {
	information,
};

export default commands;
