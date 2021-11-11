import { Command } from "../../../commands/command.ts";
import { OptionType } from "../../../commands/option.ts";
import { user } from "../../parameters.ts";

const command: Command = {
  name: "profile",
  options: [{
    name: "view",
    type: OptionType.SUB_COMMAND,
    description: "Displays the user's profile.",
    options: [user],
  }],
};

export default command;
