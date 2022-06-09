import { ClientEvents } from '../../../../../deps.ts';
import { LogEntry } from '../log-entry.ts';
import client from './client.ts';
import guild, { GuildEvents } from './guild.ts';

/**
 * Represents a list of supported log message generators for various client
 * and guild events.
 */
type MessageGenerators<E extends ClientEvents | GuildEvents> = Partial<
	{
		[key in keyof E]: LogEntry<E, key>;
	}
>;

/**
 * Represents the full collection of message generators for both the client and
 * respective guilds.
 */
interface LogEntryGenerators {
	/** Message generators for the client. */
	client: MessageGenerators<ClientEvents>;

	/** Message generators for custom events defined for guilds. */
	guild: MessageGenerators<GuildEvents>;
}

/** Contains the message generators for the client and for guilds respectively. */
const generators: LogEntryGenerators = {
	client: client,
	guild: guild,
};

export default generators;
export type { MessageGenerators };
