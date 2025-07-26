import { handleDisplayAcknowledgements } from "rost/commands/handlers/acknowledgements";
import { handleDisplayCredits } from "rost/commands/handlers/credits";
import type { InteractionHandler } from "rost/commands/handlers/handler";
import { handleDisplayBotInformation } from "rost/commands/handlers/information/bot";
import { handleDisplayGuildInformation } from "rost/commands/handlers/information/guild";
import {
	handleDisplayAuthorPraises,
	handleDisplayPraisesAutocomplete,
	handleDisplayTargetPraises,
} from "rost/commands/handlers/list/praises";
import { handleDisplayWarnings, handleDisplayWarningsAutocomplete } from "rost/commands/handlers/list/warnings";
import { handleFastForward, handleFastForwardAutocomplete } from "rost/commands/handlers/music/fast-forward";
import { handleDisplayPlaybackHistory } from "rost/commands/handlers/music/history";
import { handleLoopPlayback } from "rost/commands/handlers/music/loop";
import { handleDisplayCurrentlyPlaying } from "rost/commands/handlers/music/now";
import { handlePausePlayback } from "rost/commands/handlers/music/pause";
import { handleRequestStreamPlayback, handleRequestYouTubePlayback } from "rost/commands/handlers/music/play";
import { handleDisplayPlaybackQueue } from "rost/commands/handlers/music/queue";
import { handleRemoveSongListing } from "rost/commands/handlers/music/remove";
import { handleReplayAction } from "rost/commands/handlers/music/replay";
import { handleResumePlayback } from "rost/commands/handlers/music/resume";
import { handleRewind, handleRewindAutocomplete } from "rost/commands/handlers/music/rewind";
import { handleSkipAction } from "rost/commands/handlers/music/skip";
import { handleSkipToTimestamp, handleSkipToTimestampAutocomplete } from "rost/commands/handlers/music/skip-to";
import { handleStopPlayback } from "rost/commands/handlers/music/stop";
import { handleUnskipAction } from "rost/commands/handlers/music/unskip";
import { handleDisplayVolume } from "rost/commands/handlers/music/volume/display";
import { handleSetVolume } from "rost/commands/handlers/music/volume/set";
import { handlePardonUser, handlePardonUserAutocomplete } from "rost/commands/handlers/pardon";
import { handleDisplayModerationPolicy } from "rost/commands/handlers/policy";
import { handlePraiseUser, handlePraiseUserAutocomplete } from "rost/commands/handlers/praise";
import { handleOpenRoleSelectionMenu } from "rost/commands/handlers/profile/roles";
import { handleDisplayProfile, handleDisplayProfileAutocomplete } from "rost/commands/handlers/profile/view";
import { handlePurgeMessages, handlePurgeMessagesAutocomplete } from "rost/commands/handlers/purge";
import { handleMakeReport } from "rost/commands/handlers/report";
import { handleSubmitResource } from "rost/commands/handlers/resource";
import { handleDisplayResources } from "rost/commands/handlers/resources";
import { handleCiteRule, handleCiteRuleAutocomplete } from "rost/commands/handlers/rule";
import { handleToggleSlowmode, handleToggleSlowmodeAutocomplete } from "rost/commands/handlers/slowmode";
import { handleMakeSuggestion } from "rost/commands/handlers/suggestion";
import { handleOpenTicket } from "rost/commands/handlers/ticket/open";
import { handleClearTimeout, handleClearTimeoutAutocomplete } from "rost/commands/handlers/timeout/clear";
import { handleSetTimeout, handleSetTimeoutAutocomplete } from "rost/commands/handlers/timeout/set";
import { handleWarnUser, handleWarnUserAutocomplete } from "rost/commands/handlers/warn";

/**
 * @remarks
 * Commands, command groups and options are ordered alphabetically.
 */
const commands = Object.freeze({
	information: {
		identifier: "information",
		type: Discord.ApplicationCommandTypes.ChatInput,
		defaultMemberPermissions: ["VIEW_CHANNEL"],
		options: {
			bot: {
				identifier: "bot",
				type: Discord.ApplicationCommandOptionTypes.SubCommand,
				handle: handleDisplayBotInformation,
				options: { show: constants.parameters.show },
				flags: { isShowable: true },
			},
			server: {
				identifier: "server",
				type: Discord.ApplicationCommandOptionTypes.SubCommand,
				handle: handleDisplayGuildInformation,
				options: { show: constants.parameters.show },
				flags: { isShowable: true },
			},
		},
	},
	list: {
		identifier: "list",
		type: Discord.ApplicationCommandTypes.ChatInput,
		defaultMemberPermissions: ["VIEW_CHANNEL"],
		options: {
			praises: {
				identifier: "praises",
				type: Discord.ApplicationCommandOptionTypes.SubCommandGroup,
				options: {
					author: {
						identifier: "author",
						type: Discord.ApplicationCommandOptionTypes.SubCommand,
						handle: handleDisplayAuthorPraises,
						handleAutocomplete: handleDisplayPraisesAutocomplete,
						options: { user: { ...constants.parameters.user, required: false } },
					},
					target: {
						identifier: "target",
						type: Discord.ApplicationCommandOptionTypes.SubCommand,
						handle: handleDisplayTargetPraises,
						handleAutocomplete: handleDisplayPraisesAutocomplete,
						options: { user: { ...constants.parameters.user, required: false } },
					},
				},
			},
			warnings: {
				identifier: "warnings",
				type: Discord.ApplicationCommandOptionTypes.SubCommand,
				handle: handleDisplayWarnings,
				handleAutocomplete: handleDisplayWarningsAutocomplete,
				options: { user: { ...constants.parameters.user, required: false } },
			},
		},
	},
	resources: {
		identifier: "resources",
		type: Discord.ApplicationCommandTypes.ChatInput,
		defaultMemberPermissions: ["VIEW_CHANNEL"],
		handle: handleDisplayResources,
		options: { show: constants.parameters.show },
		flags: { isShowable: true },
	},
	acknowledgements: {
		identifier: "acknowledgements",
		type: Discord.ApplicationCommandTypes.ChatInput,
		handle: handleDisplayAcknowledgements,
		defaultMemberPermissions: ["VIEW_CHANNEL"],
	},
	credits: {
		identifier: "credits",
		type: Discord.ApplicationCommandTypes.ChatInput,
		handle: handleDisplayCredits,
		defaultMemberPermissions: ["VIEW_CHANNEL"],
	},
	pardon: {
		identifier: "pardon",
		type: Discord.ApplicationCommandTypes.ChatInput,
		defaultMemberPermissions: ["MODERATE_MEMBERS"],
		handle: handlePardonUser,
		handleAutocomplete: handlePardonUserAutocomplete,
		options: {
			user: constants.parameters.user,
			warning: {
				identifier: "warning",
				type: Discord.ApplicationCommandOptionTypes.String,
				required: true,
				autocomplete: true,
			},
		},
	},
	policy: {
		identifier: "policy",
		type: Discord.ApplicationCommandTypes.ChatInput,
		defaultMemberPermissions: ["VIEW_CHANNEL"],
		handle: handleDisplayModerationPolicy,
		options: { show: constants.parameters.show },
		flags: { isShowable: true },
	},
	purge: {
		identifier: "purge",
		type: Discord.ApplicationCommandTypes.ChatInput,
		defaultMemberPermissions: ["MODERATE_MEMBERS"],
		handle: handlePurgeMessages,
		handleAutocomplete: handlePurgeMessagesAutocomplete,
		options: {
			start: {
				identifier: "start",
				type: Discord.ApplicationCommandOptionTypes.String,
				required: true,
			},
			end: {
				identifier: "end",
				type: Discord.ApplicationCommandOptionTypes.String,
			},
			author: { ...constants.parameters.user, identifier: "author", required: false },
		},
	},
	report: {
		identifier: "report",
		type: Discord.ApplicationCommandTypes.ChatInput,
		defaultMemberPermissions: ["VIEW_CHANNEL"],
		handle: handleMakeReport,
	},
	rule: {
		identifier: "rule",
		type: Discord.ApplicationCommandTypes.ChatInput,
		defaultMemberPermissions: ["VIEW_CHANNEL"],
		handle: handleCiteRule,
		handleAutocomplete: handleCiteRuleAutocomplete,
		options: {
			rule: {
				identifier: "rule",
				type: Discord.ApplicationCommandOptionTypes.String,
				required: true,
				autocomplete: true,
			},
			show: constants.parameters.show,
		},
		flags: { isShowable: true },
	},
	slowmode: {
		identifier: "slowmode",
		type: Discord.ApplicationCommandTypes.ChatInput,
		defaultMemberPermissions: ["MODERATE_MEMBERS"],
		handle: handleToggleSlowmode,
		handleAutocomplete: handleToggleSlowmodeAutocomplete,
		options: {
			level: {
				identifier: "level",
				type: Discord.ApplicationCommandOptionTypes.String,
				autocomplete: true,
			},
		},
	},
	timeout: {
		identifier: "timeout",
		type: Discord.ApplicationCommandTypes.ChatInput,
		defaultMemberPermissions: ["MODERATE_MEMBERS"],
		options: {
			set: {
				identifier: "set",
				type: Discord.ApplicationCommandOptionTypes.SubCommand,
				handle: handleSetTimeout,
				handleAutocomplete: handleSetTimeoutAutocomplete,
				options: {
					user: constants.parameters.user,
					duration: constants.parameters.duration,
					reason: constants.parameters.reason,
				},
			},
			clear: {
				identifier: "clear",
				type: Discord.ApplicationCommandOptionTypes.SubCommand,
				handle: handleClearTimeout,
				handleAutocomplete: handleClearTimeoutAutocomplete,
				options: { user: constants.parameters.user },
			},
		},
	},
	warn: {
		identifier: "warn",
		type: Discord.ApplicationCommandTypes.ChatInput,
		defaultMemberPermissions: ["MODERATE_MEMBERS"],
		handle: handleWarnUser,
		handleAutocomplete: handleWarnUserAutocomplete,
		options: {
			user: constants.parameters.user,
			rule: {
				identifier: "rule",
				type: Discord.ApplicationCommandOptionTypes.String,
				required: true,
				autocomplete: true,
			},
			reason: constants.parameters.reason,
		},
	},
	//Server
	resource: {
		identifier: "resource",
		type: Discord.ApplicationCommandTypes.ChatInput,
		defaultMemberPermissions: ["VIEW_CHANNEL"],
		handle: handleSubmitResource,
	},
	suggestion: {
		identifier: "suggestion",
		type: Discord.ApplicationCommandTypes.ChatInput,
		defaultMemberPermissions: ["VIEW_CHANNEL"],
		handle: handleMakeSuggestion,
	},
	ticket: {
		identifier: "ticket",
		type: Discord.ApplicationCommandTypes.ChatInput,
		defaultMemberPermissions: ["VIEW_CHANNEL"],
		options: {
			open: {
				identifier: "open",
				type: Discord.ApplicationCommandOptionTypes.SubCommand,
				handle: handleOpenTicket,
			},
		},
	},
	music: {
		identifier: "music",
		type: Discord.ApplicationCommandTypes.ChatInput,
		defaultMemberPermissions: ["VIEW_CHANNEL"],
		options: {
			fastForward: {
				identifier: "fast-forward",
				type: Discord.ApplicationCommandOptionTypes.SubCommand,
				handle: handleFastForward,
				handleAutocomplete: handleFastForwardAutocomplete,
				options: { timestamp: constants.parameters.timestamp },
			},
			history: {
				identifier: "history",
				type: Discord.ApplicationCommandOptionTypes.SubCommand,
				handle: handleDisplayPlaybackHistory,
				options: { show: constants.parameters.show },
				flags: { isShowable: true },
			},
			loop: {
				identifier: "loop",
				type: Discord.ApplicationCommandOptionTypes.SubCommand,
				handle: handleLoopPlayback,
				options: { collection: constants.parameters.collection },
			},
			now: {
				identifier: "now",
				type: Discord.ApplicationCommandOptionTypes.SubCommand,
				handle: handleDisplayCurrentlyPlaying,
				options: { collection: constants.parameters.collection, show: constants.parameters.show },
				flags: { isShowable: true },
			},
			pause: {
				identifier: "pause",
				type: Discord.ApplicationCommandOptionTypes.SubCommand,
				handle: handlePausePlayback,
			},
			play: {
				identifier: "play",
				type: Discord.ApplicationCommandOptionTypes.SubCommandGroup,
				options: {
					stream: {
						identifier: "stream",
						type: Discord.ApplicationCommandOptionTypes.SubCommand,
						handle: handleRequestStreamPlayback,
						options: {
							url: {
								identifier: "url",
								type: Discord.ApplicationCommandOptionTypes.String,
								required: true,
							},
						},
					},
					youtube: {
						identifier: "youtube",
						type: Discord.ApplicationCommandOptionTypes.SubCommand,
						handle: handleRequestYouTubePlayback,
						options: { query: constants.parameters.query },
					},
				},
			},
			queue: {
				identifier: "queue",
				type: Discord.ApplicationCommandOptionTypes.SubCommand,
				handle: handleDisplayPlaybackQueue,
				options: { show: constants.parameters.show },
				flags: { isShowable: true },
			},
			remove: {
				identifier: "remove",
				type: Discord.ApplicationCommandOptionTypes.SubCommand,
				handle: handleRemoveSongListing,
			},
			replay: {
				identifier: "replay",
				type: Discord.ApplicationCommandOptionTypes.SubCommand,
				handle: handleReplayAction,
				options: { collection: constants.parameters.collection },
			},
			resume: {
				identifier: "resume",
				type: Discord.ApplicationCommandOptionTypes.SubCommand,
				handle: handleResumePlayback,
			},
			rewind: {
				identifier: "rewind",
				type: Discord.ApplicationCommandOptionTypes.SubCommand,
				handle: handleRewind,
				handleAutocomplete: handleRewindAutocomplete,
				options: { timestamp: constants.parameters.timestamp },
			},
			skipTo: {
				identifier: "skip-to",
				type: Discord.ApplicationCommandOptionTypes.SubCommand,
				handle: handleSkipToTimestamp,
				handleAutocomplete: handleSkipToTimestampAutocomplete,
				options: { timestamp: constants.parameters.timestamp },
			},
			skip: {
				identifier: "skip",
				type: Discord.ApplicationCommandOptionTypes.SubCommand,
				handle: handleSkipAction,
				options: {
					collection: constants.parameters.collection,
					by: constants.parameters.by,
					to: constants.parameters.to,
				},
			},
			stop: {
				identifier: "stop",
				type: Discord.ApplicationCommandOptionTypes.SubCommand,
				handle: handleStopPlayback,
			},
			unskip: {
				identifier: "unskip",
				type: Discord.ApplicationCommandOptionTypes.SubCommand,
				handle: handleUnskipAction,
				options: {
					collection: constants.parameters.collection,
					by: constants.parameters.by,
					to: constants.parameters.to,
				},
			},
			volume: {
				identifier: "volume",
				type: Discord.ApplicationCommandOptionTypes.SubCommandGroup,
				options: {
					display: {
						identifier: "display",
						type: Discord.ApplicationCommandOptionTypes.SubCommand,
						handle: handleDisplayVolume,
						options: { show: constants.parameters.show },
						flags: { isShowable: true },
					},
					set: {
						identifier: "set",
						type: Discord.ApplicationCommandOptionTypes.SubCommand,
						handle: handleSetVolume,
						options: {
							volume: {
								identifier: "volume",
								type: Discord.ApplicationCommandOptionTypes.Integer,
								required: true,
							},
						},
					},
				},
			},
		},
	},
	praise: {
		identifier: "praise",
		type: Discord.ApplicationCommandTypes.ChatInput,
		defaultMemberPermissions: ["VIEW_CHANNEL"],
		handle: handlePraiseUser,
		handleAutocomplete: handlePraiseUserAutocomplete,
		options: {
			user: constants.parameters.user,
			comment: {
				identifier: "comment",
				type: Discord.ApplicationCommandOptionTypes.String,
			},
		},
	},
	profile: {
		identifier: "profile",
		type: Discord.ApplicationCommandTypes.ChatInput,
		defaultMemberPermissions: ["VIEW_CHANNEL"],
		options: {
			view: {
				identifier: "view",
				type: Discord.ApplicationCommandOptionTypes.SubCommand,
				handle: handleDisplayProfile,
				handleAutocomplete: handleDisplayProfileAutocomplete,
				options: { user: { ...constants.parameters.user, required: false }, show: constants.parameters.show },
				flags: { isShowable: true },
			},
			roles: {
				identifier: "roles",
				type: Discord.ApplicationCommandOptionTypes.SubCommand,
				handle: handleOpenRoleSelectionMenu,
			},
		},
	},
} satisfies Record<string, CommandTemplate>);
type CommandTemplates = typeof commands;
type CommandName = keyof CommandTemplates;

type BuiltCommands = CommandTemplates & Record<CommandName, BuiltCommand>;

interface OptionFlags {
	readonly hasRateLimit?: boolean;
	readonly isShowable?: boolean;
}
interface OptionMetadata {
	readonly identifier: string;
	readonly handle?: InteractionHandler;
	readonly handleAutocomplete?: InteractionHandler;
	readonly flags?: OptionFlags;
}

type Command = Discord.CreateApplicationCommand;
type Option = Discord.ApplicationCommandOption;

interface CommandBuilderBase<Generic extends { built: boolean }> extends OptionMetadata {
	readonly type: Discord.ApplicationCommandTypes;
	readonly defaultMemberPermissions: Discord.PermissionStrings[];
	readonly options?: Record<string, OptionBuilder<Generic>>;
}
type CommandBuilder<Generic extends { built: boolean } = { built: boolean }> = true extends Generic["built"]
	? CommandBuilderBase<Generic> & {
			key: string;
			built: Discord.CreateApplicationCommand;
		}
	: CommandBuilderBase<Generic>;

interface OptionBuilderBase<Generic extends { built: boolean }> extends OptionMetadata {
	readonly type: Discord.ApplicationCommandOptionTypes;
	readonly required?: boolean;
	readonly choices?: Discord.ApplicationCommandOptionChoice[];
	readonly channelTypes?: Discord.ChannelTypes[];
	readonly minimumValue?: number;
	readonly maximumValue?: number;
	readonly minimumLength?: number;
	readonly maximumLength?: number;
	readonly autocomplete?: boolean;
	readonly options?: Record<string, OptionBuilder<Generic>>;
}
type OptionBuilder<Generic extends { built: boolean } = { built: boolean }> = true extends Generic["built"]
	? OptionBuilderBase<Generic> & {
			key: string;
			built: Discord.ApplicationCommandOption;
		}
	: OptionBuilderBase<Generic>;

type CommandTemplate = CommandBuilder<{ built: false }>;
type OptionTemplate = OptionBuilder<{ built: false }>;

type BuiltCommand = CommandBuilder<{ built: true }>;
type BuiltOption = OptionBuilder<{ built: true }>;

export default commands;
export type {
	CommandBuilder,
	OptionBuilder,
	BuiltCommands,
	BuiltCommand,
	BuiltOption,
	Command,
	CommandName,
	CommandTemplates,
	CommandTemplate,
	OptionMetadata,
	Option,
	OptionTemplate,
};
