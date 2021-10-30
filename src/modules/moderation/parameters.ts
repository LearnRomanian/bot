import { ApplicationCommandOptionType } from "../../../deps.ts";
import { Option } from "../option.ts";

const duration: Option = {
  name: "duration",
  description: "The duration of the sanction.",
  required: true,
  type: ApplicationCommandOptionType.STRING,
};

const reason: Option = {
  name: "reason",
  description: "The reason for the sanction or its repeal.",
  required: true,
  type: ApplicationCommandOptionType.STRING,
};

export { duration, reason };
