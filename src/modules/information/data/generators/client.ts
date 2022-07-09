import { ClientEvents, Member } from '../../../../../deps.ts';
import configuration from '../../../../configuration.ts';
import { code, codeMultiline } from '../../../../formatting.ts';
import { mentionUser } from '../../../../utils.ts';
import { MessageGenerators } from './generators.ts';

/** Contains the message generators for client events. */
const client: MessageGenerators<ClientEvents> = {
	'guildBanAdd': {
		title: '⚔️ User banned',
		message: (_guild, user) => `${mentionUser(user)} has been banned.`,
		filter: (origin, guild, user) => origin.id === guild.id && !user.bot,
		color: configuration.interactions.responses.colors.red,
	},
	'guildBanRemove': {
		title: '😇 User unbanned',
		message: (_guild, user) => `${mentionUser(user)} has been unbanned.`,
		filter: (origin, guild, user) => origin.id === guild.id && !user.bot,
		color: configuration.interactions.responses.colors.yellow,
	},
	'guildMemberAdd': {
		title: '😁 User joined',
		message: (member) => `${mentionUser(member.user)} has joined the server.`,
		filter: (origin, member) =>
			origin.id === member.guild.id && !member.user.bot,
		color: configuration.interactions.responses.colors.green,
	},
	'guildMemberRemove': {
		title: '😔 User kicked or left',
		message: (member) =>
			`${
				mentionUser(member.user)
			} has left the server, or they have been kicked.`,
		filter: (origin, member) =>
			origin.id === member.guild.id && !member.user.bot,
		color: configuration.interactions.responses.colors.yellow,
	},
	'guildMemberUpdate': {
		title: '👆 User updated',
		message: resolveMemberUpdate,
		filter: (origin, _before, after) =>
			origin.id === after.guild.id && !after.user.bot,
		color: configuration.interactions.responses.colors.blue,
	},
	'messageUpdate': {
		title: '👆 Message updated',
		message: (before, after) =>
			`${mentionUser(after.author)} updated their message in ${after.channel}.

**BEFORE**
${codeMultiline(before.content)}
**AFTER**
${codeMultiline(after.content)}`,
		filter: (origin, before, after) =>
			origin.id === before.guild?.id && !before.author.bot &&
			before.content !== after.content,
		color: configuration.interactions.responses.colors.blue,
	},
	'messageDelete': {
		title: '❌ Message deleted',
		message: (message) =>
			`${mentionUser(message.author)} deleted their message.

**CONTENT**
${codeMultiline(message.content)}`,
		filter: (origin, message) =>
			origin.id === message.guild?.id && !message.author.bot,
		color: configuration.interactions.responses.colors.red,
	},
};

/** Represents a log message generator for a member update event. */
interface MemberUpdateLogGenerator {
	/** The condition that must be met for the message to be logged. */
	condition: boolean;

	/** The message to log. */
	message: string;
}

/**
 * Represents a delegator of member updates to log message generators.
 *
 * @param before - The previous state of the member.
 * @param after - The current state of the member.
 * @returns An array of message generators as per the input values.
 */
type MemberUpdateLogDelegator = (
	before: Member,
	after: Member,
) => MemberUpdateLogGenerator[];

/** Provided inputs, generates an array of log entry messages. */
const memberUpdates: MemberUpdateLogDelegator = (
	before,
	after,
) => [
	{
		condition: before.nick !== after.nick && !before.nick,
		message: `${mentionUser(before.user)} has set their nickname to ${
			code(after.nick!)
		}.`,
	},
	{
		condition: before.nick !== after.nick && !!after.nick,
		message: `${mentionUser(before.user)} has changed their nickname to ${
			code(after.nick!)
		}.`,
	},
	{
		condition: before.nick !== after.nick && !after.nick,
		message: `${mentionUser(before.user)} has removed their nickname.`,
	},
];

/** Provided inputs, resolves them to a member update message. */
function resolveMemberUpdate(
	before: Member,
	after: Member,
): string | undefined {
	for (const entry of memberUpdates(before, after)) {
		if (entry.condition) return entry.message;
	}

	return undefined;
}

export default client;
