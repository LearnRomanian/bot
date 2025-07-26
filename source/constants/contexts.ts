import type { RuleOrOther } from "rost:constants/rules";
import type { SlowmodeLevel } from "rost:constants/slowmode";
import type { TimeUnit } from "rost:constants/time";
import type { Client } from "rost/client";

type ContextBuilder<T extends object> = ({
	localise,
	localiseRaw,
	locale,
}: { localise: Client["localise"]; localiseRaw?: Client["localiseRaw"]; locale: Discord.Locale }) => T;

export default Object.freeze({
	botInformation: ({ localise, locale }) => ({
		concept: {
			title: localise("information.options.bot.strings.concept.title", locale)(),
			description: localise("information.options.bot.strings.concept.description", locale),
		},
		function: {
			title: localise("information.options.bot.strings.function.title", locale)(),
			description: localise("information.options.bot.strings.function.description", locale)(),
			features: {
				information: localise("information.options.bot.strings.function.features.information", locale)(),
				moderation: localise("information.options.bot.strings.function.features.moderation", locale)(),
				roles: localise("information.options.bot.strings.function.features.roles", locale)(),
				music: localise("information.options.bot.strings.function.features.music", locale)(),
				social: localise("information.options.bot.strings.function.features.social", locale)(),
			},
		},
	}),
	guildInformation: ({ localise, locale }) => ({
		title: localise("information.options.server.strings.information.title", locale),
		description: {
			description: {
				title: localise("information.options.server.strings.information.description.description", locale)(),
				noDescription: localise(
					"information.options.server.strings.information.description.noDescription",
					locale,
				)(),
			},
			members: localise("information.options.server.strings.information.description.members", locale)(),
			created: localise("information.options.server.strings.information.description.created", locale)(),
			channels: localise("information.options.server.strings.information.description.channels", locale)(),
			languages: localise("information.options.server.strings.information.description.languages", locale)(),
			owner: localise("information.options.server.strings.information.description.owner", locale)(),
			moderators: {
				title: localise("information.options.server.strings.information.description.moderators", locale)(),
				overseenByModerators: localise(
					"information.options.server.strings.information.description.overseenByModerators",
					locale,
				)(),
			},
			distribution: localise("information.options.server.strings.information.description.distribution", locale)(),
		},
	}),
	withoutProficiency: ({ localise, locale }) => ({
		withoutProficiency: localise(
			"information.options.server.strings.information.description.withoutProficiency",
			locale,
		)(),
	}),
	channelTypes: ({ localise, locale }) => ({
		text: localise("information.options.server.strings.channelTypes.text", locale)(),
		voice: localise("information.options.server.strings.channelTypes.voice", locale)(),
	}),
	noWarningsForSelf: ({ localise, locale }) => ({
		title: localise("list.options.warnings.strings.noActiveWarnings.title", locale)(),
		description: localise("list.options.warnings.strings.noActiveWarnings.description.self", locale)(),
	}),
	noWarningsForOther: ({ localise, locale }) => ({
		title: localise("list.options.warnings.strings.noActiveWarnings.title", locale)(),
		description: localise("list.options.warnings.strings.noActiveWarnings.description.other", locale)(),
	}),
	noPraisesForSelfAsAuthor: ({ localise, locale }) => ({
		title: localise("list.options.praises.strings.noPraises.title", locale)(),
		description: localise("list.options.praises.strings.noPraises.description.self.author", locale)(),
	}),
	noPraisesForSelfAsTarget: ({ localise, locale }) => ({
		title: localise("list.options.praises.strings.noPraises.title", locale)(),
		description: localise("list.options.praises.strings.noPraises.description.self.target", locale)(),
	}),
	noPraisesForOtherAsAuthor: ({ localise, locale }) => ({
		title: localise("list.options.praises.strings.noPraises.title", locale)(),
		description: localise("list.options.praises.strings.noPraises.description.other.author", locale)(),
	}),
	noPraisesForOtherAsTarget: ({ localise, locale }) => ({
		title: localise("list.options.praises.strings.noPraises.title", locale)(),
		description: localise("list.options.praises.strings.noPraises.description.other.target", locale)(),
	}),
	praise: ({ localise, locale }) => ({
		title: localise("list.options.praises.strings.praises.title", locale)(),
		noComment: localise("list.options.praises.strings.praises.noComment", locale)(),
	}),
	warnings: ({ localise, locale }) => ({
		title: localise("list.options.warnings.strings.warnings.title", locale)(),
		warning: localise("list.options.warnings.strings.warnings.description.warning", locale),
	}),
	roleLimitReached: ({ localise, locale }) => ({
		title: localise("warn.strings.limitReached.title", locale)(),
		description: {
			limitReached: localise("profile.options.roles.strings.limitReached.description.limitReached", locale)(),
			toChooseNew: localise("profile.options.roles.strings.limitReached.description.toChooseNew", locale)(),
		},
	}),
	previousRoleCategory: ({ localise, locale }) => ({
		back: localise("profile.options.roles.strings.back", locale)(),
	}),
	answerModal: ({ localise, locale }) => ({
		title: localise("answer.title", locale)(),
		fields: {
			question: localise("answer.fields.question", locale)(),
			answer: localise("answer.fields.answer", locale)(),
		},
	}),
	reportModal: ({ localise, locale }) => ({
		title: localise("report.title", locale)(),
		fields: {
			reason: localise("report.fields.reason", locale)(),
			users: localise("report.fields.users", locale)(),
			link: localise("report.fields.link", locale)(),
		},
	}),
	resourceModal: ({ localise, locale }) => ({
		title: localise("resource.title", locale)(),
		fields: {
			resource: localise("resource.fields.resource", locale)(),
		},
	}),
	suggestionModal: ({ localise, locale }) => ({
		title: localise("suggestion.title", locale)(),
		fields: {
			suggestion: localise("suggestion.fields.suggestion", locale)(),
		},
	}),
	ticketModal: ({ localise, locale }) => ({
		title: localise("ticket.title", locale)(),
		topic: localise("ticket.fields.topic", locale)(),
	}),
	failedToSubmitForm: ({ localise, locale }) => ({
		title: localise("form.failedToSubmit.title", locale)(),
		description: localise("form.failedToSubmit.description", locale)(),
		continue: localise("prompts.continue", locale)(),
		cancel: localise("prompts.cancel", locale)(),
	}),
	queue: ({ localise, locale }) => ({
		queue: localise("music.options.queue.strings.queue", locale)(),
	}),
	queueEmpty: ({ localise, locale }) => ({
		title: localise("music.options.remove.strings.queueEmpty.title", locale)(),
		description: localise("music.options.remove.strings.queueEmpty.description", locale)(),
	}),
	page: ({ localise, locale }) => ({
		page: localise("interactions.page", locale)(),
	}),
	selectSongToRemove: ({ localise, locale }) => ({
		title: localise("music.options.remove.strings.selectSong.title", locale)(),
		description: localise("music.options.remove.strings.selectSong.description", locale)(),
	}),
	continuedOnNextPage: ({ localise, locale }) => ({
		continuedOnNextPage: localise("interactions.continuedOnNextPage", locale)(),
	}),
	tooManyReports: ({ localise, locale }) => ({
		title: localise("report.strings.tooMany.title", locale)(),
		description: localise("report.strings.tooMany.description", locale)(),
	}),
	reportSubmitted: ({ localise, locale }) => ({
		title: localise("report.strings.submitted.title", locale)(),
		description: localise("report.strings.submitted.description", locale)(),
	}),
	tooManyResources: ({ localise, locale }) => ({
		title: localise("resource.strings.tooMany.title", locale)(),
		description: localise("resource.strings.tooMany.description", locale)(),
	}),
	resourceSent: ({ localise, locale }) => ({
		title: localise("resource.strings.sent.title", locale)(),
		description: localise("resource.strings.sent.description", locale)(),
	}),
	tooManySuggestions: ({ localise, locale }) => ({
		title: localise("suggestion.strings.tooMany.title", locale)(),
		description: localise("suggestion.strings.tooMany.description", locale)(),
	}),
	suggestionSent: ({ localise, locale }) => ({
		title: localise("suggestion.strings.sent.title", locale)(),
		description: localise("suggestion.strings.sent.description", locale)(),
	}),
	notPlayingMusicToCheck: ({ localise, locale }) => ({
		title: localise("music.strings.notPlaying.title", locale)(),
		description: localise("music.strings.notPlaying.description.toCheck", locale)(),
	}),
	notPlayingMusicToManage: ({ localise, locale }) => ({
		title: localise("music.strings.notPlaying.title", locale)(),
		description: localise("music.strings.notPlaying.description.toManage", locale)(),
	}),
	volume: ({ localise, locale }) => ({
		title: localise("music.options.volume.options.display.strings.volume.title", locale)(),
		description: localise("music.options.volume.options.display.strings.volume.description", locale),
	}),
	volumeInvalid: ({ localise, locale }) => ({
		title: localise("music.options.volume.options.set.strings.invalid.title", locale)(),
		description: localise("music.options.volume.options.set.strings.invalid.description", locale),
	}),
	volumeSet: ({ localise, locale }) => ({
		title: localise("music.options.volume.options.set.strings.set.title", locale)(),
		description: localise("music.options.volume.options.set.strings.set.description", locale),
	}),
	noSongToFastForward: ({ localise, locale }) => ({
		title: localise("music.options.fast-forward.strings.noSong.title", locale)(),
		description: localise("music.options.fast-forward.strings.noSong.description", locale)(),
	}),
	fastForwarded: ({ localise, locale }) => ({
		title: localise("music.options.fast-forward.strings.fastForwarded.title", locale)(),
		description: localise("music.options.fast-forward.strings.fastForwarded.description", locale)(),
	}),
	invalidFastForwardTimestamp: ({ localise, locale }) => ({
		title: localise("music.options.fast-forward.strings.invalidTimestamp.title", locale)(),
		description: localise("music.options.fast-forward.strings.invalidTimestamp.description", locale)(),
	}),
	autocompleteTimestamp: ({ localise, locale }) => ({
		autocomplete: localise("autocomplete.timestamp", locale)(),
	}),
	musicHistory: ({ localise, locale }) => ({
		title: localise("music.options.history.strings.playbackHistory", locale)(),
	}),
	noSongToLoop: ({ localise, locale }) => ({
		title: localise("music.options.loop.strings.noSong.title", locale)(),
		description: localise("music.options.loop.strings.noSong.description", locale)(),
	}),
	noSongCollectionToLoop: ({ localise, locale }) => ({
		title: localise("music.options.loop.strings.noSongCollection.title", locale)(),
		description: {
			noSongCollection: localise(
				"music.options.loop.strings.noSongCollection.description.noSongCollection",
				locale,
			)(),
			trySongInstead: localise(
				"music.options.loop.strings.noSongCollection.description.trySongInstead",
				locale,
			)(),
		},
	}),
	loopDisabledForSong: ({ localise, locale }) => ({
		title: localise("music.options.loop.strings.disabled.title", locale)(),
		description: localise("music.options.loop.strings.disabled.description.song", locale)(),
	}),
	loopEnabledForSong: ({ localise, locale }) => ({
		title: localise("music.options.loop.strings.enabled.title", locale)(),
		description: localise("music.options.loop.strings.enabled.description.song", locale)(),
	}),
	loopDisabledForSongCollection: ({ localise, locale }) => ({
		title: localise("music.options.loop.strings.disabled.title", locale)(),
		description: localise("music.options.loop.strings.disabled.description.songCollection", locale)(),
	}),
	loopEnabledForSongCollection: ({ localise, locale }) => ({
		title: localise("music.options.loop.strings.enabled.title", locale)(),
		description: localise("music.options.loop.strings.enabled.description.songCollection", locale)(),
	}),
	noSongToShowInformationAbout: ({ localise, locale }) => ({
		title: localise("music.options.now.strings.noSong.title", locale)(),
		description: localise("music.options.now.strings.noSong.description", locale)(),
	}),
	noSongCollectionToShowInformationAbout: ({ localise, locale }) => ({
		title: localise("music.options.now.strings.noSongCollection.title", locale)(),
		description: {
			noSongCollection: localise(
				"music.options.now.strings.noSongCollection.description.noSongCollection",
				locale,
			)(),
			trySongInstead: localise("music.options.now.strings.noSongCollection.description.trySongInstead", locale)(),
		},
	}),
	nowPlayingSong: ({ localise, locale }) => ({
		nowPlaying: localise("music.options.now.strings.nowPlaying", locale)(),
		songs: localise("music.options.now.strings.songs", locale)(),
	}),
	nowPlayingSongCollection: ({ localise, locale }) => ({
		nowPlaying: localise("music.options.now.strings.nowPlaying", locale)(),
		collection: localise("music.options.now.strings.collection", locale)(),
		track: localise("music.options.now.strings.track", locale)(),
		title: localise("music.options.now.strings.title", locale)(),
		requestedBy: localise("music.options.now.strings.requestedBy", locale)(),
		runningTime: localise("music.options.now.strings.runningTime", locale)(),
		playingSince: localise("music.options.now.strings.playingSince", locale),
		sourcedFrom: localise("music.options.now.strings.sourcedFrom", locale),
		theInternet: localise("music.options.now.strings.theInternet", locale)(),
	}),
	songNotFound: ({ localise, locale }) => ({
		title: localise("music.options.play.strings.notFound.title", locale)(),
		description: {
			notFound: localise("music.options.play.strings.notFound.description.notFound", locale)(),
			tryDifferentQuery: localise("music.options.play.strings.notFound.description.tryDifferentQuery", locale)(),
		},
	}),
	musicPaused: ({ localise, locale }) => ({
		title: localise("music.options.pause.strings.paused.title", locale)(),
		description: localise("music.options.pause.strings.paused.description", locale)(),
	}),
	failedToRemoveSong: ({ localise, locale }) => ({
		title: localise("music.options.remove.strings.failed.title", locale)(),
		description: localise("music.options.remove.strings.failed.description", locale)(),
	}),
	removedSong: ({ localise, locale }) => ({
		title: localise("music.options.remove.strings.removed.title", locale)(),
		description: localise("music.options.remove.strings.removed.description", locale),
	}),
	noSongToReplay: ({ localise, locale }) => ({
		title: localise("music.options.replay.strings.noSong.title", locale)(),
		description: localise("music.options.replay.strings.noSong.description", locale)(),
	}),
	noSongCollectionToReplay: ({ localise, locale }) => ({
		title: localise("music.options.replay.strings.noSongCollection.title", locale)(),
		description: {
			noSongCollection: localise(
				"music.options.replay.strings.noSongCollection.description.noSongCollection",
				locale,
			)(),
			trySongInstead: localise(
				"music.options.replay.strings.noSongCollection.description.trySongInstead",
				locale,
			)(),
		},
	}),
	replaying: ({ localise, locale }) => ({
		title: localise("music.options.replay.strings.replaying.title", locale)(),
		description: localise("music.options.replay.strings.replaying.description", locale)(),
	}),
	notPaused: ({ localise, locale }) => ({
		title: localise("music.options.resume.strings.notPaused.title", locale)(),
		description: localise("music.options.resume.strings.notPaused.description", locale)(),
	}),
	resumed: ({ localise, locale }) => ({
		title: localise("music.options.resume.strings.resumed.title", locale)(),
		description: localise("music.options.resume.strings.resumed.description", locale)(),
	}),
	noSongToRewind: ({ localise, locale }) => ({
		title: localise("music.options.rewind.strings.noSong.title", locale)(),
		description: localise("music.options.rewind.strings.noSong.description", locale)(),
	}),
	rewound: ({ localise, locale }) => ({
		title: localise("music.options.rewind.strings.rewound.title", locale)(),
		description: localise("music.options.rewind.strings.rewound.description", locale)(),
	}),
	invalidRewindTimestamp: ({ localise, locale }) => ({
		title: localise("music.options.rewind.strings.invalidTimestamp.title", locale)(),
		description: localise("music.options.rewind.strings.invalidTimestamp.description", locale)(),
	}),
	noSongToSkipToTimestampInside: ({ localise, locale }) => ({
		title: localise("music.options.skip-to.strings.noSong.title", locale)(),
		description: localise("music.options.skip-to.strings.noSong.description", locale)(),
	}),
	skippedTo: ({ localise, locale }) => ({
		title: localise("music.options.skip-to.strings.skippedTo.title", locale)(),
		description: localise("music.options.skip-to.strings.skippedTo.description", locale)(),
	}),
	invalidSkipToTimestamp: ({ localise, locale }) => ({
		title: localise("music.options.skip-to.strings.invalidTimestamp.title", locale)(),
		description: localise("music.options.skip-to.strings.invalidTimestamp.description", locale)(),
	}),
	noSongToSkip: ({ localise, locale }) => ({
		title: localise("music.options.skip.strings.noSong.title", locale)(),
		description: localise("music.options.skip.strings.noSong.description", locale)(),
	}),
	noSongCollectionToSkip: ({ localise, locale }) => ({
		title: localise("music.options.skip.strings.noSongCollection.title", locale)(),
		description: {
			noSongCollection: localise(
				"music.options.skip.strings.noSongCollection.description.noSongCollection",
				locale,
			)(),
			trySongInstead: localise(
				"music.options.skip.strings.noSongCollection.description.trySongInstead",
				locale,
			)(),
		},
	}),
	tooManySkipArguments: ({ localise, locale }) => ({
		title: localise("music.strings.skips.tooManyArguments.title", locale)(),
		description: localise("music.strings.skips.tooManyArguments.description", locale)(),
	}),
	invalidSkipArgument: ({ localise, locale }) => ({
		title: localise("music.strings.skips.invalid.title", locale)(),
		description: localise("music.strings.skips.invalid.description", locale)(),
	}),
	skippedSong: ({ localise, locale }) => ({
		title: localise("music.options.skip.strings.skippedSong.title", locale)(),
		description: localise("music.options.skip.strings.skippedSong.description", locale)(),
	}),
	skippedSongCollection: ({ localise, locale }) => ({
		title: localise("music.options.skip.strings.skippedSongCollection.title", locale)(),
		description: localise("music.options.skip.strings.skippedSongCollection.description", locale)(),
	}),
	stopped: ({ localise, locale }) => ({
		title: localise("music.options.stop.strings.stopped.title", locale)(),
		description: localise("music.options.stop.strings.stopped.description", locale)(),
	}),
	unskipHistoryEmpty: ({ localise, locale }) => ({
		title: localise("music.options.unskip.strings.historyEmpty.title", locale)(),
		description: localise("music.options.unskip.strings.historyEmpty.description", locale)(),
	}),
	unskipQueueFull: ({ localise, locale }) => ({
		title: localise("music.options.unskip.strings.queueFull.title", locale)(),
		description: localise("music.options.unskip.strings.queueFull.description", locale)(),
	}),
	noSongCollectionToUnskip: ({ localise, locale }) => ({
		title: localise("music.options.unskip.strings.noSongCollection.title", locale)(),
		description: {
			noSongCollection: localise(
				"music.options.unskip.strings.noSongCollection.description.noSongCollection",
				locale,
			)(),
			trySongInstead: localise(
				"music.options.unskip.strings.noSongCollection.description.trySongInstead",
				locale,
			)(),
		},
	}),
	tooManyUnskipArguments: ({ localise, locale }) => ({
		title: localise("music.strings.skips.tooManyArguments.title", locale)(),
		description: localise("music.strings.skips.tooManyArguments.description", locale)(),
	}),
	unskipped: ({ localise, locale }) => ({
		title: localise("music.options.unskip.strings.unskipped.title", locale)(),
		description: localise("music.options.unskip.strings.unskipped.description", locale)(),
	}),
	invalidRule: ({ localise, locale }) => ({
		title: localise("warn.strings.invalidRule.title", locale)(),
		description: localise("warn.strings.invalidRule.description", locale)(),
	}),
	userWarned: ({ localise, locale }) => ({
		title: localise("warn.strings.warned.title", locale)(),
		description: localise("warn.strings.warned.description", locale),
	}),
	selectSong: ({ localise, locale }) => ({
		title: localise("music.options.play.strings.selectSong.title", locale)(),
		description: localise("music.options.play.strings.selectSong.description", locale)(),
	}),
	howToSelectRoles: ({ localise, locale }) => ({
		title: localise("roles.selection.title", locale)(),
		description: {
			usingCommand: localise("roles.selection.description.usingCommand", locale),
			runAnywhere: localise("roles.selection.description.runAnywhere", locale)(),
			pressButton: localise("roles.selection.description.pressButton", locale)(),
			clickHere: localise("roles.selection.description.clickHere", locale)(),
		},
	}),
	welcomeNotice: ({ localise, locale }) => ({
		title: localise("entry.welcome.title", locale),
		description: {
			toEnter: localise("entry.welcome.description.toEnter", locale),
			acceptedRules: localise("entry.welcome.description.acceptedRules", locale)(),
		},
	}),
	reportPrompt: ({ localise, locale }) => ({
		report: {
			submittedBy: localise("submittedBy", locale)(),
			submittedAt: localise("submittedAt", locale)(),
			users: localise("reports.users", locale)(),
			reason: localise("reports.reason", locale)(),
			link: localise("reports.link", locale)(),
			noLinkProvided: localise("reports.noLinkProvided", locale)(),
		},
		previousInfractions: {
			title: localise("reports.previousInfractions", locale),
		},
		markResolved: localise("markResolved", locale)(),
		markUnresolved: localise("markUnresolved", locale)(),
		close: localise("close", locale)(),
	}),
	alreadyMarkedResolved: ({ localise, locale }) => ({
		title: localise("alreadyMarkedResolved.title", locale)(),
		description: localise("alreadyMarkedResolved.description", locale)(),
	}),
	alreadyMarkedUnresolved: ({ localise, locale }) => ({
		title: localise("alreadyMarkedUnresolved.title", locale)(),
		description: localise("alreadyMarkedUnresolved.description", locale)(),
	}),
	promptControls: ({ localise, locale }) => ({
		markResolved: localise("markResolved", locale)(),
		markUnresolved: localise("markUnresolved", locale)(),
		close: localise("close", locale)(),
		remove: localise("remove", locale)(),
	}),
	cannotRemovePrompt: ({ localise, locale }) => ({
		title: localise("cannotRemovePrompt.title", locale)(),
		description: localise("cannotRemovePrompt.description", locale)(),
	}),
	cannotCloseIssue: ({ localise, locale }) => ({
		title: localise("cannotCloseIssue.title", locale)(),
		description: localise("cannotCloseIssue.description", locale)(),
	}),
	entryRequestPrompt: ({ localise, locale }) => ({
		requestedRoles: localise("entry.verification.requestedRoles", locale)(),
		accountCreated: localise("entry.verification.accountCreated", locale)(),
		answersSubmitted: localise("entry.verification.answersSubmitted", locale)(),
		votesFor: localise("entry.verification.votesFor", locale)(),
		votesAgainst: localise("entry.verification.votesAgainst", locale)(),
		noneYet: localise("entry.verification.noneYet", locale)(),
		accept: localise("entry.verification.vote.accept", locale)(),
		acceptMultiple: localise("entry.verification.vote.acceptMultiple", locale),
		reject: localise("entry.verification.vote.reject", locale)(),
		rejectMultiple: localise("entry.verification.vote.rejectMultiple", locale),
		inquiry: localise("entry.verification.inquiry.inquiry", locale)(),
		open: localise("entry.verification.inquiry.open", locale)(),
	}),
	sureToForceAccept: ({ localise, locale }) => ({
		title: localise("entry.verification.vote.sureToForce.accept.title", locale)(),
		description: localise("entry.verification.vote.sureToForce.accept.description", locale)(),
		yes: localise("entry.verification.vote.sureToForce.yes", locale)(),
		no: localise("entry.verification.vote.sureToForce.no", locale)(),
	}),
	alreadyVotedInFavour: ({ localise, locale }) => ({
		title: localise("entry.verification.vote.alreadyVoted.inFavour.title", locale)(),
		description: localise("entry.verification.vote.alreadyVoted.inFavour.description", locale)(),
	}),
	sureToForceReject: ({ localise, locale }) => ({
		title: localise("entry.verification.vote.sureToForce.reject.title", locale)(),
		description: localise("entry.verification.vote.sureToForce.reject.description", locale)(),
		yes: localise("entry.verification.vote.sureToForce.yes", locale)(),
		no: localise("entry.verification.vote.sureToForce.no", locale)(),
	}),
	alreadyVotedAgainst: ({ localise, locale }) => ({
		title: localise("entry.verification.vote.alreadyVoted.against.title", locale)(),
		description: localise("entry.verification.vote.alreadyVoted.against.description", locale)(),
	}),
	stanceChanged: ({ localise, locale }) => ({
		title: localise("entry.verification.vote.stanceChanged.title", locale)(),
		description: localise("entry.verification.vote.stanceChanged.description", locale)(),
	}),
	inquiryFailed: ({ localise, locale }) => ({
		title: localise("entry.verification.inquiry.failed.title", locale)(),
		description: localise("entry.verification.inquiry.failed.description", locale)(),
	}),
	inquiryOpened: ({ localise, locale }) => ({
		title: localise("entry.verification.inquiry.opened.title", locale)(),
		description: localise("entry.verification.inquiry.opened.description", locale),
	}),
	voteFailed: ({ localise, locale }) => ({
		title: localise("entry.verification.vote.failed.title", locale)(),
		description: localise("entry.verification.vote.failed.description", locale)(),
	}),
	tooManyTickets: ({ localise, locale }) => ({
		title: localise("ticket.strings.tooMany.title", locale)(),
		description: localise("ticket.strings.tooMany.description", locale)(),
	}),
	ticketSent: ({ localise, locale }) => ({
		title: localise("ticket.strings.sent.title", locale)(),
		description: localise("ticket.strings.sent.description", locale)(),
	}),
	notTimedOut: ({ localise, locale }) => ({
		title: localise("timeout.strings.notTimedOut.title", locale)(),
		description: localise("timeout.strings.notTimedOut.description", locale),
	}),
	timeoutCleared: ({ localise, locale }) => ({
		title: localise("timeout.strings.timeoutCleared.title", locale)(),
		description: localise("timeout.strings.timeoutCleared.description", locale),
	}),
	timedOut: ({ localise, locale }) => ({
		title: localise("timeout.strings.timedOut.title", locale)(),
		description: localise("timeout.strings.timedOut.description", locale),
	}),
	timeoutDurationInvalid: ({ localise, locale }) => ({
		title: localise("timeout.strings.durationInvalid.title", locale)(),
		description: localise("timeout.strings.durationInvalid.description", locale)(),
	}),
	timeoutDurationTooShort: ({ localise, locale }) => ({
		title: localise("timeout.strings.tooShort.title", locale)(),
		description: localise("timeout.strings.tooShort.description", locale)(),
	}),
	timeoutDurationTooLong: ({ localise, locale }) => ({
		title: localise("timeout.strings.tooLong.title", locale)(),
		description: localise("timeout.strings.tooLong.description", locale)(),
	}),
	verificationModal: ({ localise, locale }) => ({
		title: localise("verification.title", locale)(),
		fields: {
			reason: localise("verification.fields.reason", locale)(),
			aim: localise("verification.fields.aim", locale)(),
			whereFound: localise("verification.fields.whereFound", locale)(),
		},
	}),
	sureToCancelReport: ({ localise, locale }) => ({
		title: localise("report.strings.sureToCancel.title", locale)(),
		description: localise("report.strings.sureToCancel.description", locale)(),
		stay: localise("prompts.stay", locale)(),
		leave: localise("prompts.leave", locale)(),
	}),
	listEmpty: ({ localise, locale }) => ({
		listEmpty: localise("music.strings.listEmpty", locale)(),
	}),
	profile: ({ localise, locale }) => ({
		title: localise("profile.options.view.strings.information.title", locale),
		roles: localise("profile.options.view.strings.information.description.roles", locale)(),
		statistics: localise("profile.options.view.strings.information.description.statistics", locale)(),
		praises: localise("profile.options.view.strings.information.description.praises", locale)(),
		warnings: localise("profile.options.view.strings.information.description.warnings", locale)(),
		received: localise("profile.options.view.strings.information.description.received", locale)(),
		sent: localise("profile.options.view.strings.information.description.sent", locale)(),
	}),
	acknowledgements: ({ localise, locale }) => ({
		acknowledgements: localise("acknowledgements.strings.acknowledgements", locale)(),
	}),
	credits: ({ localise, locale }) => ({
		translation: localise("credits.strings.translation", locale)(),
	}),
	pardoned: ({ localise, locale }) => ({
		title: localise("pardon.strings.pardoned.title", locale)(),
		description: localise("pardon.strings.pardoned.description", locale),
	}),
	invalidWarning: ({ localise, locale }) => ({
		title: localise("pardon.strings.invalidWarning.title", locale)(),
		description: localise("pardon.strings.invalidWarning.description", locale)(),
	}),
	moderationPolicy: ({ localise, locale }) => ({
		title: localise("policies.moderation.title", locale)(),
		points: {
			introduction: {
				title: localise("policies.moderation.points.introduction.title", locale)(),
				description: localise("policies.moderation.points.introduction.description", locale)(),
			},
			breach: {
				title: localise("policies.moderation.points.breach.title", locale)(),
				description: localise("policies.moderation.points.breach.description", locale)(),
			},
			warnings: {
				title: localise("policies.moderation.points.warnings.title", locale)(),
				description: localise("policies.moderation.points.warnings.description", locale)(),
			},
			furtherAction: {
				title: localise("policies.moderation.points.furtherAction.title", locale)(),
				description: localise("policies.moderation.points.furtherAction.description", locale)(),
			},
			ban: {
				title: localise("policies.moderation.points.ban.title", locale)(),
				description: localise("policies.moderation.points.ban.description", locale)(),
			},
		},
	}),
	cannotPraiseSelf: ({ localise, locale }) => ({
		title: localise("praise.strings.cannotPraiseSelf.title", locale)(),
		description: localise("praise.strings.cannotPraiseSelf.description", locale)(),
	}),
	tooManyPraises: ({ localise, locale }) => ({
		title: localise("praise.strings.tooMany.title", locale)(),
		description: localise("praise.strings.tooMany.description", locale)(),
	}),
	praised: ({ localise, locale }) => ({
		title: localise("praise.strings.praised.title", locale)(),
		description: localise("praise.strings.praised.description", locale),
	}),
	invalidSlowmodeLevel: ({ localise, locale }) => ({
		title: localise("slowmode.strings.invalid.title", locale)(),
		description: localise("slowmode.strings.invalid.description", locale)(),
	}),
	slowmodeDowngraded: ({ localise, locale }) => ({
		title: localise("slowmode.strings.downgraded.title", locale)(),
		description: localise("slowmode.strings.downgraded.description", locale)(),
	}),
	slowmodeUpgraded: ({ localise, locale }) => ({
		title: localise("slowmode.strings.upgraded.title", locale)(),
		description: localise("slowmode.strings.upgraded.description", locale)(),
	}),
	theSameSlowmodeLevel: ({ localise, locale }) => ({
		title: localise("slowmode.strings.theSame.title", locale)(),
		description: {
			theSame: localise("slowmode.strings.theSame.description.theSame", locale)(),
			chooseDifferent: localise("slowmode.strings.theSame.description.chooseDifferent", locale)(),
		},
	}),
	slowmodeTooSoon: ({ localise, locale }) => ({
		title: localise("slowmode.strings.tooSoon.title", locale)(),
		description: {
			justEnabled: localise("slowmode.strings.tooSoon.description.justEnabled", locale)(),
			canDisableIn: localise("slowmode.strings.tooSoon.description.canDisableIn", locale),
		},
	}),
	slowmodeDisabled: ({ localise, locale }) => ({
		title: localise("slowmode.strings.disabled.title", locale)(),
		description: localise("slowmode.strings.disabled.description", locale)(),
	}),
	slowmodeEnabled: ({ localise, locale }) => ({
		title: localise("slowmode.strings.enabled.title", locale)(),
		description: localise("slowmode.strings.enabled.description", locale)(),
	}),
	warningLimitSurpassedAndTimedOut: ({ localise, locale }) => ({
		title: localise("warn.strings.limitSurpassedTimedOut.title", locale)(),
		description: localise("warn.strings.limitSurpassedTimedOut.description", locale),
	}),
	warningLimitSurpassed: ({ localise, locale }) => ({
		title: localise("warn.strings.limitSurpassed.title", locale)(),
		description: localise("warn.strings.limitSurpassed.description", locale),
	}),
	limitReached: ({ localise, locale }) => ({
		title: localise("warn.strings.limitReached.title", locale)(),
		description: localise("warn.strings.limitReached.description", locale),
	}),
	roleMenu: ({ localise, locale }) => ({
		chooseCategory: localise("profile.options.roles.strings.chooseCategory", locale)(),
		chooseRole: localise("profile.options.roles.strings.chooseRole", locale)(),
	}),
	resourceNotice: ({ localise, locale }) => ({
		title: localise("notices.resources.title", locale)(),
		description: {
			storedInRepository: localise("notices.resources.description.storedInRepository", locale),
			easierToManage: localise("notices.resources.description.easierToManage", locale)(),
			contributable: {
				contributable: localise("notices.resources.description.contributable", locale)(),
				usingCommand: localise("notices.resources.description.contributable.usingCommand", locale),
				openingIssue: localise("notices.resources.description.contributable.openingIssue", locale)(),
				pullRequest: localise("notices.resources.description.contributable.makingPullRequest", locale)(),
			},
		},
		redirect: localise("resources.strings.redirect", locale)(),
	}),
	inquiryChannel: ({ localise, locale }) => ({
		inquiryChannel: localise("entry.verification.inquiry.channel", locale),
	}),
	chooseProficiency: ({ localise, locale }) => ({
		title: localise("entry.proficiency.title", locale)(),
		description: {
			chooseProficiency: localise("entry.proficiency.description.chooseProficiency", locale)(),
			canChangeLater: localise("entry.proficiency.description.canChangeLater", locale),
		},
	}),
	getVerified: ({ localise, locale }) => ({
		title: localise("entry.verification.getVerified.title", locale)(),
		description: {
			verificationRequired: localise("entry.verification.getVerified.description.verificationRequired", locale),
			honestAnswers: localise("entry.verification.getVerified.description.honestAnswers", locale)(),
			understood: localise("entry.verification.getVerified.description.understood", locale)(),
		},
	}),
	alreadyAnswered: ({ localise, locale }) => ({
		title: localise("entry.verification.answers.alreadyAnswered.title", locale)(),
		description: localise("entry.verification.answers.alreadyAnswered.description", locale)(),
	}),
	verificationAnswersSubmitted: ({ localise, locale }) => ({
		title: localise("entry.verification.answers.submitted.title", locale)(),
		description: {
			submitted: localise("entry.verification.answers.submitted.description.submitted", locale)(),
			willBeReviewed: localise("entry.verification.answers.submitted.description.willBeReviewed", locale)(),
		},
	}),
	rejectedBefore: ({ localise, locale }) => ({
		title: localise("entry.verification.answers.rejectedBefore.title", locale)(),
		description: localise("entry.verification.answers.rejectedBefore.description", locale)(),
	}),
	receivedAccess: ({ localise, locale }) => ({
		title: localise("entry.proficiency.receivedAccess.title", locale)(),
		description: {
			nowMember: localise("entry.proficiency.receivedAccess.description.nowMember", locale),
			toStart: localise("entry.proficiency.receivedAccess.description.toStart", locale)(),
		},
	}),
	sureToShow: ({ localise, locale }) => ({
		title: localise("interactions.show.sureToShow.title", locale)(),
		description: localise("interactions.show.sureToShow.description", locale)(),
		yes: localise("interactions.show.sureToShow.yes", locale)(),
		no: localise("interactions.show.sureToShow.no", locale)(),
	}),
	show: ({ localise, locale }) => ({
		show: localise("interactions.show", locale)(),
	}),
	source: ({ localise, locale }) => ({
		source: localise("interactions.source", locale)(),
	}),
	purge: ({ localise, locale }) => ({
		start: localise("purge.strings.start", locale)(),
		end: localise("purge.strings.end", locale)(),
		posted: localise("purge.strings.posted", locale),
		embedPosted: localise("purge.strings.embedPosted", locale),
		messagesFound: localise("purge.strings.messagesFound", locale)(),
	}),
	indexing: ({ localise, locale }) => ({
		title: localise("purge.strings.indexing.title", locale)(),
		description: localise("purge.strings.indexing.description", locale)(),
	}),
	rangeTooBig: ({ localise, locale }) => ({
		title: localise("purge.strings.rangeTooBig.title", locale)(),
		description: {
			rangeTooBig: localise("purge.strings.rangeTooBig.description.rangeTooBig", locale),
			trySmaller: localise("purge.strings.rangeTooBig.description.trySmaller", locale)(),
		},
	}),
	indexedNoResults: ({ localise, locale }) => ({
		title: localise("purge.strings.indexed.title", locale)(),
		description: {
			none: localise("purge.strings.indexed.description.none", locale)(),
			tryDifferentQuery: localise("purge.strings.indexed.description.tryDifferentQuery", locale)(),
		},
	}),
	indexedFoundMessagesToDelete: ({ localise, locale }) => ({
		indexed: {
			title: localise("purge.strings.indexed.title", locale)(),
			description: {
				some: localise("purge.strings.indexed.description.some", locale),
			},
		},
		sureToPurge: {
			title: localise("purge.strings.sureToPurge.title", locale)(),
			description: localise("purge.strings.sureToPurge.description", locale),
		},
		yes: localise("purge.strings.yes", locale)(),
		no: localise("purge.strings.no", locale)(),
	}),
	tooManyMessagesToDelete: ({ localise, locale }) => ({
		indexed: {
			title: localise("purge.strings.indexed.title", locale)(),
			description: {
				tooMany: localise("purge.strings.indexed.description.tooMany", locale),
				limited: localise("purge.strings.indexed.description.limited", locale),
			},
		},
		continue: {
			title: localise("purge.strings.continue.title", locale)(),
			description: localise("purge.strings.continue.description", locale),
		},
		yes: localise("purge.strings.yes", locale)(),
		no: localise("purge.strings.no", locale)(),
	}),
	purging: ({ localise, locale }) => ({
		title: localise("purge.strings.purging.title", locale)(),
		description: {
			purging: localise("purge.strings.purging.description.purging", locale),
			mayTakeTime: localise("purge.strings.purging.description.mayTakeTime", locale)(),
			onceComplete: localise("purge.strings.purging.description.onceComplete", locale)(),
		},
	}),
	purged: ({ localise, locale }) => ({
		title: localise("purge.strings.purged.title", locale)(),
		description: localise("purge.strings.purged.description", locale),
	}),
	invalidPurgeParameters: ({ localise, locale }) => ({
		start: {
			title: localise("purge.strings.invalid.start.title", locale)(),
			description: localise("purge.strings.invalid.start.description", locale)(),
		},
		end: {
			title: localise("purge.strings.invalid.end.title", locale)(),
			description: localise("purge.strings.invalid.end.description", locale)(),
		},
		both: {
			title: localise("purge.strings.invalid.both.title", locale)(),
			description: localise("purge.strings.invalid.both.description", locale)(),
		},
	}),
	idsNotDifferent: ({ localise, locale }) => ({
		title: localise("purge.strings.idsNotDifferent.title", locale)(),
		description: localise("purge.strings.idsNotDifferent.description", locale)(),
	}),
	purgeFailed: ({ localise, locale }) => ({
		title: localise("purge.strings.failed.title", locale)(),
		description: localise("purge.strings.failed.description", locale)(),
	}),
	purgeNoContent: ({ localise, locale }) => ({
		noContent: localise("purge.strings.noContent", locale)(),
	}),
	musicHalted: ({ localise, locale }) => ({
		title: localise("music.strings.outage.halted.title", locale)(),
		description: {
			outage: localise("music.strings.outage.halted.description.outage", locale)(),
			noLoss: localise("music.strings.outage.halted.description.noLoss", locale)(),
		},
	}),
	musicRestored: ({ localise, locale }) => ({
		title: localise("music.strings.outage.restored.title", locale)(),
		description: localise("music.strings.outage.restored.description", locale)(),
	}),
	cannotManageDuringOutage: ({ localise, locale }) => ({
		title: localise("music.strings.outage.cannotManage.title", locale)(),
		description: {
			outage: localise("music.strings.outage.cannotManage.description.outage", locale)(),
			backUpSoon: localise("music.strings.outage.cannotManage.description.backUpSoon", locale)(),
		},
	}),
	notInVc: ({ localise, locale }) => ({
		title: localise("music.strings.notInVc.title", locale)(),
		description: {
			toManage: localise("music.strings.notInVc.description.toManage", locale)(),
			toCheck: localise("music.strings.notInVc.description.toCheck", locale)(),
		},
	}),
	botInDifferentVc: ({ localise, locale }) => ({
		title: localise("music.options.play.strings.inDifferentVc.title", locale)(),
		description: localise("music.options.play.strings.inDifferentVc.description", locale)(),
	}),
	queueFull: ({ localise, locale }) => ({
		title: localise("music.options.play.strings.queueFull.title", locale)(),
		description: localise("music.options.play.strings.queueFull.description", locale)(),
	}),
	queued: ({ localise, locale }) => ({
		title: localise("music.options.play.strings.queued.title", locale)(),
		description: localise("music.options.play.strings.queued.description.public", locale),
	}),
	failedToLoadTrack: ({ localise, locale }) => ({
		title: localise("music.options.play.strings.failedToLoad.title", locale)(),
		description: localise("music.options.play.strings.failedToLoad.description", locale),
	}),
	invalidUser: ({ localise, locale }) => ({
		title: localise("interactions.invalidUser.title", locale)(),
		description: localise("interactions.invalidUser.description", locale)(),
	}),
	guildBanAdd: ({ localise, locale }) => ({
		title: localise("events.banAdd.title", locale)(),
		description: localise("events.banAdd.description", locale),
	}),
	guildBanRemove: ({ localise, locale }) => ({
		title: localise("events.banRemove.title", locale)(),
		description: localise("events.banRemove.description", locale),
	}),
	guildMemberAdd: ({ localise, locale }) => ({
		title: localise("events.memberAdd.title", locale)(),
		description: localise("events.memberAdd.description", locale),
	}),
	guildMemberRemove: ({ localise, locale }) => ({
		title: localise("events.memberRemove.title", locale)(),
		description: localise("events.memberRemove.description", locale),
	}),
	messageDelete: ({ localise, locale }) => ({
		title: localise("events.messageDelete.title", locale)(),
		description: localise("events.messageDelete.description", locale),
		fields: {
			content: localise("events.messageDelete.fields.content", locale)(),
		},
	}),
	messageDeleteBulk: ({ localise, locale }) => ({
		title: localise("events.messageDeleteBulk.title", locale)(),
		description: localise("events.messageDeleteBulk.description", locale),
	}),
	messageUpdate: ({ localise, locale }) => ({
		title: localise("events.messageUpdate.title", locale)(),
		description: localise("events.messageUpdate.description", locale),
		fields: {
			before: localise("events.messageUpdate.fields.before", locale)(),
			after: localise("events.messageUpdate.fields.after", locale)(),
		},
	}),
	memberKick: ({ localise, locale }) => ({
		title: localise("events.memberKick.title", locale)(),
		description: localise("events.memberKick.description", locale),
	}),
	entryRequestAccept: ({ localise, locale }) => ({
		title: localise("events.entryRequestAccept.title", locale)(),
		description: localise("events.entryRequestAccept.description", locale),
	}),
	entryRequestReject: ({ localise, locale }) => ({
		title: localise("events.entryRequestReject.title", locale)(),
		description: localise("events.entryRequestReject.description", locale),
	}),
	entryRequestSubmit: ({ localise, locale }) => ({
		title: localise("events.entryRequestSubmit.title", locale)(),
		description: localise("events.entryRequestSubmit.description", locale),
	}),
	inquiryOpen: ({ localise, locale }) => ({
		title: localise("events.inquiryOpen.title", locale)(),
		description: localise("events.inquiryOpen.description", locale),
		fields: {
			topic: localise("events.inquiryOpen.fields.topic", locale)(),
		},
	}),
	memberTimeoutAdd: ({ localise, locale }) => ({
		title: localise("events.memberTimeoutAdd.title", locale)(),
		description: localise("events.memberTimeoutAdd.description", locale),
		fields: {
			reason: localise("events.memberTimeoutAdd.fields.reason", locale)(),
			lastsUntil: localise("events.memberTimeoutAdd.fields.lastsUntil", locale)(),
		},
	}),
	memberTimeoutRemove: ({ localise, locale }) => ({
		title: localise("events.memberTimeoutRemove.title", locale)(),
		description: localise("events.memberTimeoutRemove.description", locale),
	}),
	memberWarnAdd: ({ localise, locale }) => ({
		title: localise("events.memberWarnAdd.title", locale)(),
		description: localise("events.memberWarnAdd.description", locale),
		fields: {
			reason: localise("events.memberWarnAdd.fields.reason", locale)(),
		},
	}),
	memberWarnRemove: ({ localise, locale }) => ({
		title: localise("events.memberWarnRemove.title", locale)(),
		description: localise("events.memberWarnRemove.description", locale),
		fields: {
			warning: localise("events.memberWarnRemove.fields.warning", locale)(),
		},
	}),
	praiseAdd: ({ localise, locale }) => ({
		title: localise("events.praiseAdd.title", locale)(),
		description: localise("events.praiseAdd.description", locale),
		fields: {
			comment: localise("events.praiseAdd.fields.comment", locale)(),
		},
	}),
	purgeBegin: ({ localise, locale }) => ({
		title: localise("events.purgeBegin.title", locale)(),
		description: localise("events.purgeBegin.description", locale),
		fields: {
			author: localise("events.purgeBegin.fields.author", locale)(),
		},
	}),
	purgeEnd: ({ localise, locale }) => ({
		title: localise("events.purgeEnd.title", locale)(),
		description: localise("events.purgeEnd.description", locale),
		fields: {
			author: localise("events.purgeEnd.fields.author", locale)(),
		},
	}),
	reportSubmit: ({ localise, locale }) => ({
		title: localise("events.reportSubmit.title", locale)(),
		description: localise("events.reportSubmit.description", locale),
		fields: {
			reason: localise("events.reportSubmit.fields.reason", locale)(),
			reportedUsers: localise("events.reportSubmit.fields.reportedUsers", locale)(),
			messageLink: localise("events.reportSubmit.fields.messageLink", locale)(),
		},
	}),
	resourceSend: ({ localise, locale }) => ({
		title: localise("events.resourceSend.title", locale)(),
		description: localise("events.resourceSend.description", locale),
		fields: {
			resource: localise("events.resourceSend.fields.resource", locale)(),
		},
	}),
	slowmodeDisable: ({ localise, locale }) => ({
		title: localise("events.slowmodeDisable.title", locale)(),
		description: localise("events.slowmodeDisable.description", locale),
	}),
	slowmodeDowngrade: ({ localise, locale }) => ({
		title: localise("events.slowmodeDowngrade.title", locale)(),
		description: localise("events.slowmodeDowngrade.description", locale),
	}),
	slowmodeEnable: ({ localise, locale }) => ({
		title: localise("events.slowmodeEnable.title", locale)(),
		description: localise("events.slowmodeEnable.description", locale),
	}),
	slowmodeUpgrade: ({ localise, locale }) => ({
		title: localise("events.slowmodeUpgrade.title", locale)(),
		description: localise("events.slowmodeUpgrade.description", locale),
	}),
	suggestionSend: ({ localise, locale }) => ({
		title: localise("events.suggestionSend.title", locale)(),
		description: localise("events.suggestionSend.description", locale),
		fields: {
			suggestion: localise("events.suggestionSend.fields.suggestion", locale)(),
		},
	}),
	ticketOpen: ({ localise, locale }) => ({
		title: localise("events.ticketOpen.title", locale)(),
		description: localise("events.ticketOpen.description", locale),
		fields: {
			topic: localise("events.ticketOpen.fields.topic", locale)(),
		},
	}),
	autocompleteLanguage: ({ localise, locale }) => ({
		autocomplete: localise("autocomplete.language", locale)(),
	}),
	likelyMatch: ({ localise, locale }) => ({
		title: localise("recognise.strings.fields.likelyMatches.title", locale)(),
		description: localise("recognise.strings.fields.likelyMatches.description.single", locale),
	}),
	likelyMatches: ({ localise, locale }) => ({
		title: localise("recognise.strings.fields.likelyMatches.title", locale)(),
		description: localise("recognise.strings.fields.likelyMatches.description.multiple", locale)(),
	}),
	otherRuleOption: ({ localise, locale }) => ({
		option: localise("warn.options.rule.strings.other", locale)(),
	}),
	invite: ({ localise, locale }) => ({
		invite: localise("notices.notices.information.invite", locale)(),
	}),
	inquiry: ({ localise, locale }) => ({
		inquiry: localise("entry.verification.inquiry.inquiry", locale)(),
	}),
	failedToPlay: ({ localise, locale }) => ({
		title: localise("music.options.play.strings.failedToPlay.title", locale)(),
		description: localise("music.options.play.strings.failedToPlay.description", locale),
	}),
	thinking: ({ localise, locale }) => ({
		thinking: localise("interactions.thinking", locale)(),
	}),
	autocompleteUser: ({ localise, locale }) => ({
		autocomplete: localise("autocomplete.user", locale)(),
	}),
	roleCategory: ({ localise, locale }) => ({
		name: ({ id }: { id: string }) => localise(`${id}.name`, locale)(),
		description: ({ id }: { id: string }) => localise(`${id}.description`, locale)(),
	}),
	assignedRoles: ({ localise, locale }) => ({
		assigned: localise("profile.options.roles.strings.assigned", locale)(),
	}),
	role: ({ localise, localiseRaw, locale }) => ({
		name: ({ id }: { id: string }) => localise(`${id}.name`, locale)(),
		description: ({ id }: { id: string }) => localiseRaw!(`${id}.description`, locale)(),
	}),
	possibleMatch: ({ localise, locale }) => ({
		title: localise("recognise.strings.fields.possibleMatches.title", locale)(),
		description: localise("recognise.strings.fields.possibleMatches.description.single", locale),
	}),
	possibleMatches: ({ localise, locale }) => ({
		title: localise("recognise.strings.fields.possibleMatches.title", locale)(),
		description: localise("recognise.strings.fields.possibleMatches.description.multiple", locale)(),
	}),
	redirect: ({ localise, locale }) => ({
		redirect: localise("resources.strings.redirect", locale)(),
	}),
	rules: ({ localise, locale }) => ({
		title: localise("rules.title", locale)(),
	}),
	tldr: ({ localise, locale }) => ({
		tldr: localise("rules.tldr", locale)(),
	}),
	rule: ({ localise, locale }) => ({
		title: (rule: RuleOrOther) => localise(`rules.${rule}.title`, locale)(),
		summary: (rule: RuleOrOther) => localise(`rules.${rule}.summary`, locale)(),
		content: (rule: RuleOrOther) => localise(`rules.${rule}.content`, locale)(),
	}),
	ruleInvalid: ({ localise, locale }) => ({
		title: localise("rule.strings.invalid.title", locale)(),
		description: localise("rule.strings.invalid.description", locale)(),
	}),
	slowmodeLevel: ({ localise, locale }) => ({
		level: (level: SlowmodeLevel) => localise(`slowmode.strings.levels.${level}`, locale)(),
	}),
	timeUnit: ({ localise, locale }) => ({
		one: (unit: TimeUnit) => localise(`units.${unit}.one`, locale)(),
		two: (unit: TimeUnit) => localise(`units.${unit}.two`, locale)(),
		many: (unit: TimeUnit) => localise(`units.${unit}.many`, locale)(),
		short: (unit: TimeUnit) => localise(`units.${unit}.short`, locale)(),
		shortest: (unit: TimeUnit) => localise(`units.${unit}.shortest`, locale)(),
	}),
	nowPlaying: ({ localise, locale }) => ({
		title: {
			nowPlaying: localise("music.options.play.strings.nowPlaying.title.nowPlaying", locale),
			song: localise("music.options.play.strings.nowPlaying.title.type.song", locale)(),
			stream: localise("music.options.play.strings.nowPlaying.title.type.stream", locale)(),
			songCollection: localise("music.options.play.strings.nowPlaying.title.type.songCollection", locale)(),
		},
		description: {
			nowPlaying: localise("music.options.play.strings.nowPlaying.description.nowPlaying", locale),
			track: localise("music.options.play.strings.nowPlaying.description.track", locale),
		},
	}),
	stream: ({ localise, locale }) => ({
		stream: localise("music.options.play.strings.stream", locale)(),
	}),
	rateLimited: ({ localise, locale }) => ({
		title: localise("interactions.rateLimited.title", locale)(),
		description: {
			tooManyUses: localise("interactions.rateLimited.description.tooManyUses", locale),
			cannotUseUntil: localise("interactions.rateLimited.description.cannotUseAgainUntil", locale),
		},
	}),
	inquiryInProgress: ({ localise, locale }) => ({
		title: localise("entry.verification.vote.inquiryInProgress.title", locale)(),
		description: localise("entry.verification.vote.inquiryInProgress.description", locale)(),
	}),
	noReports: ({ localise, locale }) => ({
		title: localise("allUpToDate", locale)(),
		description: localise("reports.noReports", locale)(),
	}),
	noResources: ({ localise, locale }) => ({
		title: localise("allUpToDate", locale)(),
		description: localise("resources.noResources", locale)(),
	}),
	noSuggestions: ({ localise, locale }) => ({
		title: localise("allUpToDate", locale)(),
		description: localise("suggestions.noSuggestions", locale)(),
	}),
	noTickets: ({ localise, locale }) => ({
		title: localise("allUpToDate", locale)(),
		description: localise("tickets.noTickets", locale)(),
	}),
	noEntryRequests: ({ localise, locale }) => ({
		title: localise("allUpToDate", locale)(),
		description: localise("entryRequests.noEntryRequests", locale)(),
	}),
	verificationAnswers: ({ localise, locale }) => ({
		verificationAnswers: localise("entry.verification.inquiry.verificationAnswers", locale)(),
	}),
	floodDetectedAndTimedOut: ({ localise, locale }) => ({
		title: localise("antiFlood.floodDetectedAndTimedOut.title", locale)(),
		description: localise("antiFlood.floodDetectedAndTimedOut.description", locale),
	}),
} satisfies Record<string, ContextBuilder<any>>);
export type { ContextBuilder };
