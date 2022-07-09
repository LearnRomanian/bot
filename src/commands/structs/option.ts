import { _, ApplicationCommandOptionBase } from '../../../deps.ts';
import { InteractionHandler } from './command.ts';

/** A command option with an optional handler for its execution. */
interface Option extends ApplicationCommandOptionBase<Option> {
	/** The function to be executed when this command is selected. */
	handle?: InteractionHandler;
}

export type { Option };
