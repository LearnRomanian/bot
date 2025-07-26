import type pino from "pino";
import type { Client } from "rost/client";

interface Plugin {
	readonly filename: string;
	readonly load: (client: Client) => Promise<void>;
	readonly unload?: (client: Client) => Promise<void>;
}

class PluginStore {
	readonly log: pino.Logger;

	readonly #client: Client;
	readonly #plugins: Plugin[];

	constructor(client: Client) {
		this.log = client.log.child({ name: "PluginStore" });

		this.#client = client;
		this.#plugins = [];
	}

	async setup(): Promise<void> {
		this.log.info("Looking for plugins to load...");

		const filenames = await PluginStore.#getPluginFilenames();
		if (filenames.length === 0) {
			this.log.info("There were no plugins to load.");
			return;
		}

		this.log.info(`Found ${filenames.length} plugin(s). Loading...`);

		await Promise.all(filenames.map((filename) => this.#loadPlugin(filename)));

		this.log.info(`Loaded ${filenames.length} plugin(s).`);
	}

	async teardown(): Promise<void> {
		this.log.info("Tearing down plugin store...");

		if (this.#plugins.length > 0) {
			this.log.info(`There are ${this.#plugins.length} plugin(s) to unload. Unloading...`);

			await Promise.all(this.#plugins.map((plugin) => this.#unloadPlugin(plugin)));

			this.log.info(`Unloaded ${this.#plugins.length} plugin(s).`);
		} else {
			this.log.info("No plugins to unload.");
		}

		this.log.info("Plugin store torn down.");
	}

	static async #getPluginFilenames(): Promise<string[]> {
		return Array.fromAsync(new Bun.Glob("*.ts").scan(constants.directories.plugins));
	}

	async #loadPlugin(filename: string): Promise<void> {
		const module = await import(`../../../${constants.directories.plugins}/${filename}`);
		const plugin = { filename, ...module };

		this.#plugins.push(plugin);

		this.log.info(`Loading plugin ${plugin.filename}...`);

		await plugin.load(this.#client);

		this.log.info(`Loaded plugin ${plugin.filename}.`);
	}

	async #unloadPlugin(plugin: Plugin): Promise<void> {
		this.log.info(`Unloading plugin ${plugin.filename}...`);

		await plugin.unload?.(this.#client);

		this.log.info(`Unloaded plugin ${plugin.filename}.`);
	}
}

export { PluginStore };
