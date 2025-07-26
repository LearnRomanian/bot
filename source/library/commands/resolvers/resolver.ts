import type { Client } from "rost/client";
import type { SongListing } from "rost/services/music";

type SongListingResolver = (
	client: Client,
	interaction: Rost.Interaction,
	{ query }: { query: string },
) => Promise<SongListing | undefined>;

export type { SongListingResolver };
