interface Account {
	/** IDs of servers the user's entry request has been accepted on. */
	authorisedOn?: string[];

	/** IDs of servers the user's entry request has been rejected on. */
	rejectedOn?: string[];
}

interface UserDocument {
	createdAt: number;
	account?: Account;
}

export type { UserDocument };
