import { Command } from '../../commands/structs/command.ts';
import praise from './commands/praise.ts';
import profile from './commands/profile.ts';

const commands: Record<string, Command> = {
	praise,
	profile,
};

export default commands;
