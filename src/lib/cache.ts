import { Locale } from "logos:constants/languages";
import Redis from "ioredis";
import { Client } from "logos/client";
import { Logger } from "logos/logger";

interface SentencePair {
	readonly sentenceId: number;
	readonly sentence: string;
	readonly translationId: number;
	readonly translation: string;
}
type SentencePairEncoded = [sentenceId: number, sentence: string, translationId: number, translation: string];

class Cache {
	readonly #log: Logger;

	readonly #_redis?: Redis;

	get redis(): Redis {
		return this.#_redis!;
	}

	constructor(client: Client) {
		this.#log = Logger.create({ identifier: "Client/DatabaseStore", isDebug: client.environment.isDebug });

		if (client.environment.redisHost === undefined || client.environment.redisPort === undefined) {
			this.#log.warn(
				"Either `REDIS_HOST` and `REDIS_PORT` has not been provided. Logos will run without a Redis connection.",
			);
			return;
		}

		this.#_redis = new Redis({
			host: client.environment.redisHost,
			port: Number(client.environment.redisPort),
			password: client.environment.redisPassword,
			reconnectOnError: (_) => true,
			lazyConnect: true,
		});
	}

	async start(): Promise<void> {
		if (this.#_redis === undefined) {
			return;
		}

		await this.redis.connect();
	}

	stop(): void {
		if (this.#_redis === undefined) {
			return;
		}

		this.redis.disconnect();
	}

	async getSentencePairCount({ learningLocale }: { learningLocale: Locale }): Promise<number> {
		return this.redis.scard(`${learningLocale}:index`);
	}

	async getRandomSentencePairs({
		learningLocale,
		count,
	}: { learningLocale: Locale; count: number }): Promise<SentencePair[]> {
		const pipeline = this.redis.pipeline();
		for (const _ of Array(count).keys()) {
			pipeline.srandmember(`${learningLocale}:index`);
		}

		const results = await pipeline.exec();
		if (results === null) {
			throw "StateError: Failed to get random indexes for sentence pairs.";
		}

		const ids: string[] = [];
		for (const [error, id] of results) {
			if (error !== null || id === null) {
				throw `StateError: Failed to get random index for sentence pair: ${id}`;
			}

			ids.push(id as string);
		}

		const encodedPairs: SentencePairEncoded[] = [];
		for (const id of ids) {
			const pairEncoded = await this.redis.get(`${learningLocale}:${id}`);
			if (pairEncoded === null) {
				throw `StateError: Failed to get sentence pair for locale ${learningLocale} and index ${id}.`;
			}

			encodedPairs.push(JSON.parse(pairEncoded) as SentencePairEncoded);
		}

		return encodedPairs.map(([sentenceId, sentence, translationId, translation]) => ({
			sentenceId,
			sentence,
			translationId,
			translation,
		}));
	}
}

export { Cache };
export type { SentencePair };
