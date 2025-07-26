import { chunk } from "rost:core/utilities";
import * as Discord from "@discordeno/bot";

Array.prototype.toChunked = function <T>(this, size: number) {
	return Array.from<T[]>(chunk(this, size));
};

Promise.prototype.ignore = function (this): void {
	this.catch();
};

const globals = globalThis as any;
globals.Discord = Discord;
globals.constants = await import("./constants/constants.ts").then((module) => module.default);
