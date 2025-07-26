import type { Client } from "rost/client";
import { Collector } from "rost/collectors";
import type { RoleWithIndicator } from "rost/models/documents/guild";
import type { Guild } from "rost/models/guild";
import { LocalService } from "rost/services/service";

class RoleIndicatorService extends LocalService {
	readonly #guildMemberUpdates: Collector<"guildMemberUpdate">;

	get configuration(): NonNullable<Guild["features"]["roleIndicators"]> {
		return this.guildDocument.feature("roleIndicators");
	}

	constructor(client: Client, { guildId }: { guildId: bigint }) {
		super(client, { identifier: "RoleIndicatorService", guildId });

		this.#guildMemberUpdates = new Collector({ guildId });
	}

	async start(): Promise<void> {
		for (const member of this.guild.members.array()) {
			if (member.user === undefined) {
				continue;
			}

			await this.guildMemberUpdate(member, member.user);
		}

		this.#guildMemberUpdates.onCollect(this.guildMemberUpdate.bind(this));

		await this.client.registerCollector("guildMemberUpdate", this.#guildMemberUpdates);
	}

	async stop(): Promise<void> {
		await this.#guildMemberUpdates.close();
	}

	async guildMemberUpdate(member: Discord.Member | Rost.Member, user: Discord.User | Rost.User): Promise<void> {
		// Bots cannot change the guild owner's nickname.
		if (member.id === this.guild.ownerId) {
			return;
		}

		const applicableRolesAll: RoleWithIndicator[] = [];
		for (const role of this.configuration.roles ?? []) {
			if (!member.roles.includes(BigInt(role.roleId))) {
				continue;
			}

			applicableRolesAll.push(role);
		}

		const applicableRoles = applicableRolesAll.slice(0, this.configuration.limit ?? applicableRolesAll.length);
		const applicableIndicators = applicableRoles.map((role) => role.indicator);

		const hasApplicableIndicators = applicableIndicators.length > 0;

		if (member.nick === undefined) {
			if (!hasApplicableIndicators) {
				return;
			}

			const nickname = getNicknameWithRoleIndicators(user.username, applicableIndicators);
			this.client.bot.helpers
				.editMember(member.guildId, user.id, { nick: nickname })
				.catch((error) => this.log.warn(error, "Failed to set member's role indicators."));

			return;
		}

		const matchResult = constants.patterns.roleIndicators.exec(member.nick) ?? undefined;
		const hasIndicators = matchResult !== undefined;
		if (!hasIndicators) {
			if (!hasApplicableIndicators) {
				return;
			}

			const nickname = getNicknameWithRoleIndicators(member.nick, applicableIndicators);
			this.client.bot.helpers
				.editMember(member.guildId, user.id, { nick: nickname })
				.catch((error) => this.log.warn(error, "Failed to set member's role indicators."));

			return;
		}

		const [_, username, indicatorsFormatted] = matchResult;
		if (username === undefined || indicatorsFormatted === undefined) {
			return;
		}

		if (!hasApplicableIndicators) {
			this.client.bot.helpers
				.editMember(member.guildId, user.id, { nick: username })
				.catch((error) => this.log.warn(error, "Failed to reset member's role indicators."));

			return;
		}

		const indicators = indicatorsFormatted.split(constants.special.sigils.separator);
		const hasNoChange =
			indicators.length === applicableIndicators.length &&
			applicableIndicators.every((applicableIndicator, index) => indicators[index] === applicableIndicator);
		if (hasNoChange) {
			return;
		}

		const nicknameModified = getNicknameWithRoleIndicators(username, applicableIndicators);
		this.client.bot.helpers
			.editMember(member.guildId, user.id, { nick: nicknameModified })
			.catch((error) => this.log.warn(error, "Failed to update member's role indicators."));
	}
}

function getNicknameWithRoleIndicators(username: string, indicators: string[]): string {
	const indicatorsFormatted = indicators.join(constants.special.sigils.separator);
	const modification = `${constants.special.sigils.divider}${indicatorsFormatted}`;
	const usernameSlice = username.slice(0, constants.discord.MAXIMUM_USERNAME_LENGTH - modification.length);

	return `${usernameSlice}${modification}`;
}

export { RoleIndicatorService };
