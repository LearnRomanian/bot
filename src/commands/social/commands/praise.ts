import {
	ApplicationCommandFlags,
	ApplicationCommandOptionTypes,
	Bot,
	editOriginalInteractionResponse,
	getDmChannel,
	Interaction,
	InteractionResponseTypes,
	sendInteractionResponse,
	sendMessage,
} from '../../../../deps.ts';
import { Client, resolveInteractionToMember } from '../../../client.ts';
import { CommandBuilder } from '../../../commands/command.ts';
import configuration from '../../../configuration.ts';
import { Praise } from '../../../database/structs/users/praise.ts';
import { user } from '../../parameters.ts';
import {
	createPraise,
	getPraises,
} from '../../../database/functions/praises.ts';
import { getOrCreateUser } from '../../../database/functions/users.ts';
import { log } from '../../../controllers/logging/logging.ts';
import { guildAsAuthor, parseArguments } from '../../../utils.ts';
import {
	createLocalisations,
	localise,
} from '../../../../assets/localisations/types.ts';
import { Commands } from '../../../../assets/localisations/commands.ts';
import { mention, MentionTypes } from '../../../formatting.ts';

const command: CommandBuilder = {
	...createLocalisations(Commands.praise),
	defaultMemberPermissions: ['VIEW_CHANNEL'],
	handle: praise,
	options: [user, {
		...createLocalisations(Commands.praise.options.comment),
		type: ApplicationCommandOptionTypes.String,
	}],
};

async function praise(
	[client, bot]: [Client, Bot],
	interaction: Interaction,
): Promise<void> {
	const [{ user, comment }] = parseArguments(interaction.data!.options, {});
	if (user === undefined) return;

	const member = resolveInteractionToMember(
		[client, bot],
		interaction,
		user,
	);
	if (!member) return;

	if (member.id === interaction.member?.id) {
		return void sendInteractionResponse(
			bot,
			interaction.id,
			interaction.token,
			{
				type: InteractionResponseTypes.ChannelMessageWithSource,
				data: {
					flags: ApplicationCommandFlags.Ephemeral,
					embeds: [{
						description: localise(
							Commands.praise.strings.cannotPraiseSelf,
							interaction.locale,
						),
						color: configuration.interactions.responses.colors.yellow,
					}],
				},
			},
		);
	}

	await sendInteractionResponse(bot, interaction.id, interaction.token, {
		type: InteractionResponseTypes.DeferredChannelMessageWithSource,
		data: { flags: ApplicationCommandFlags.Ephemeral },
	});

	const showPraiseFailure = (): void => {
		return void editOriginalInteractionResponse(
			bot,
			interaction.token,
			{
				embeds: [{
					description: localise(
						Commands.praise.strings.failed,
						interaction.locale,
					),
					color: configuration.interactions.responses.colors.red,
				}],
			},
		);
	};

	const author = await getOrCreateUser(
		client.database,
		'id',
		interaction.user.id.toString(),
	);
	if (!author) return showPraiseFailure();

	const praisesByAuthor = await getPraises(
		client.database,
		'author',
		author.ref,
	);
	if (!praisesByAuthor) return showPraiseFailure();

	const praiseTimestamps = praisesByAuthor
		.map((document) => document.ts)
		.sort((a, b) => b - a); // From most recent to least recent.
	const timestampSlice = praiseTimestamps.slice(
		0,
		configuration.guilds.praises.maximum,
	);
	const canPraise = timestampSlice.length <
			configuration.guilds.praises.maximum ||
		timestampSlice.some((timestamp) =>
			(Date.now() - timestamp) >=
				configuration.guilds.praises.interval
		);
	if (!canPraise) {
		return void editOriginalInteractionResponse(
			bot,
			interaction.token,
			{
				embeds: [{
					description: localise(
						Commands.praise.strings.waitBeforePraising,
						interaction.locale,
					),
					color: configuration.interactions.responses.colors.yellow,
				}],
			},
		);
	}

	const subject = await getOrCreateUser(
		client.database,
		'id',
		member.id.toString(),
	);
	if (!subject) return showPraiseFailure();

	const praise: Praise = {
		author: author.ref,
		subject: subject.ref,
		comment: comment,
	};

	const document = await createPraise(client.database, praise);
	if (!document) return showPraiseFailure();

	const guild = client.cache.guilds.get(interaction.guildId!);
	if (!guild) return;

	log([client, bot], guild, 'praiseAdd', member, praise, interaction.user);

	const dmChannel = await getDmChannel(bot, member.id);
	if (dmChannel) {
		sendMessage(bot, dmChannel.id, {
			embeds: [
				{
					author: guildAsAuthor(bot, guild),
					description: `${
						localise(Commands.praise.strings.praisedDirect, interaction.locale)(
							mention(interaction.user.id, MentionTypes.User),
						)
					} 🥳`,
					color: configuration.interactions.responses.colors.green,
				},
			],
		});
	}

	return void editOriginalInteractionResponse(
		bot,
		interaction.token,
		{
			embeds: [{
				description: localise(
					Commands.praise.strings.praised,
					interaction.locale,
				)(mention(member.id, MentionTypes.User)),
				color: configuration.interactions.responses.colors.green,
			}],
		},
	);
}

export default command;
