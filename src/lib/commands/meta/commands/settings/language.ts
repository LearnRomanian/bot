import { OptionTemplate } from "../../../command";
import clear from "./language/clear";
import set from "./language/set";
import * as Discord from "discordeno";

const command: OptionTemplate = {
	name: "language",
	type: Discord.ApplicationCommandOptionTypes.SubCommandGroup,
	options: [clear, set],
};

export default command;
