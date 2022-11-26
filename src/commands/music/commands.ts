import { Commands, createLocalisations } from 'logos/assets/localisations/mod.ts';
import history from 'logos/src/commands/music/commands/history.ts';
import now from 'logos/src/commands/music/commands/now.ts';
import pause from 'logos/src/commands/music/commands/pause.ts';
import play from 'logos/src/commands/music/commands/play.ts';
import queue from 'logos/src/commands/music/commands/queue.ts';
import remove from 'logos/src/commands/music/commands/remove.ts';
import replay from 'logos/src/commands/music/commands/replay.ts';
import resume from 'logos/src/commands/music/commands/resume.ts';
import skip from 'logos/src/commands/music/commands/skip.ts';
import stop from 'logos/src/commands/music/commands/stop.ts';
import unskip from 'logos/src/commands/music/commands/unskip.ts';
import volume from 'logos/src/commands/music/commands/volume.ts';
import { CommandBuilder } from 'logos/src/commands/command.ts';

const music: CommandBuilder = {
	...createLocalisations(Commands.music),
	defaultMemberPermissions: ['VIEW_CHANNEL'],
	options: [
		history,
		now,
		pause,
		play,
		queue,
		remove,
		replay,
		skip,
		stop,
		resume,
		unskip,
		volume,
	],
};

const commands = [music];

export default commands;
