import { Command, unimplemented } from "../../command.ts";
import { by, to } from "../parameters.ts";

const command: Command = {
  name: "rewind",
  description: "Rewinds the currently playing song.",
  options: [by, to],
  handle: unimplemented,
};

export default command;
