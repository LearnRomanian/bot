import type { Client } from "rost/client";

type InteractionHandler = (client: Client, interaction: Rost.Interaction) => Promise<void>;

export type { InteractionHandler };
