// TODO(vxern): Improve.
interface EntryRequest {
	id: string;
	guildId: string;
	authorId: string;
	requestedRoleId: string;
	answers: {
		reason: string;
		aim: string;
		whereFound: string;
	};
	votedFor?: string[];
	votedAgainst?: string[];
	ticketChannelId?: string;
	isFinalised: boolean;
	createdAt: number;
}

export type { EntryRequest };
