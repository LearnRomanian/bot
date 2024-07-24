import type { Locale } from "logos:constants/languages/localisation";
import type { Environment } from "logos:core/loaders/environment";
import Redis from "ioredis";
import { Logger } from "logos/logger";

interface SentencePair {
	readonly sentenceId: number;
	readonly sentence: string;
	readonly translationId: number;
	readonly translation: string;
}
type SentencePairEncoded = [sentenceId: number, sentence: string, translationId: number, translation: string];
interface LemmaUses {
	readonly sentencePairs: SentencePair[];
	readonly lemmas: string[];
}

class VolatileStore {
	readonly log: Logger;

	readonly redis: Redis;

	constructor({
		log,
		host,
		port,
		password,
	}: { log: Logger; host: string; port: string; password: string | undefined }) {
		this.log = log;
		this.redis = new Redis({
			host,
			port: Number(port),
			password,
			reconnectOnError: (_) => true,
			lazyConnect: true,
		});
	}

	static tryCreate({ environment }: { environment: Environment }): VolatileStore | undefined {
		const log = Logger.create({ identifier: "Client/VolatileStore", isDebug: environment.isDebug });

		if (environment.redisHost === undefined || environment.redisPort === undefined) {
			log.warn(
				"One of `REDIS_HOST` or `REDIS_PORT` have not been provided. Logos will run without a Redis integration.",
			);
			return undefined;
		}

		return new VolatileStore({
			log,
			host: environment.redisHost,
			port: environment.redisPort,
			password: environment.redisPassword,
		});
	}

	async setup(): Promise<void> {
		this.log.info("Setting up volatile store...");

		await this.#connect();

		this.log.info("Volatile store set up.");
	}

	teardown(): void {
		this.log.info("Tearing down volatile store...");

		this.#disconnect();

		this.log.info("Volatile store torn down.");
	}

	async #connect(): Promise<void> {
		this.log.info("Connecting to Redis instance...");

		await this.redis.connect();

		this.log.info("Connected to Redis instance.");
	}

	#disconnect(): void {
		this.log.info("Disconnecting from Redis instance...");

		this.redis.disconnect();

		this.log.info("Disconnected from Redis instance...");
	}

	getSentencePairCount({ learningLocale }: { learningLocale: Locale }): Promise<number> {
		return this.redis.scard(constants.keys.redis.sentencePairIndex({ locale: learningLocale }));
	}

	async getSentencePairs({
		sentenceIds,
		learningLocale,
	}: { sentenceIds: string[]; learningLocale: Locale }): Promise<SentencePair[]> {
		const encodedPairs: SentencePairEncoded[] = [];
		for (const sentenceId of sentenceIds) {
			const pairEncoded = await this.redis.get(
				constants.keys.redis.sentencePair({ locale: learningLocale, sentenceId }),
			);
			if (pairEncoded === null) {
				throw new Error(`Failed to get sentence pair for locale ${learningLocale} and ID ${sentenceId}.`);
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

	async getRandomSentencePairs({
		learningLocale,
		count,
	}: { learningLocale: Locale; count: number }): Promise<SentencePair[]> {
		const pipeline = this.redis.pipeline();
		for (const _ of new Array(count).keys()) {
			pipeline.srandmember(constants.keys.redis.sentencePairIndex({ locale: learningLocale }));
		}

		const results = await pipeline.exec();
		if (results === null) {
			throw new Error("Failed to get random indexes for sentence pairs.");
		}

		const sentenceIds: string[] = [];
		for (const [error, sentenceId] of results) {
			if (error !== null || sentenceId === null) {
				throw new Error(`Failed to get random index for sentence pair: ${sentenceId}`);
			}

			sentenceIds.push(sentenceId as string);
		}

		return this.getSentencePairs({ sentenceIds, learningLocale });
	}

	searchForLemmaUses({
		lemmas,
		learningLocale,
		caseSensitive = false,
	}: { lemmas: string[]; learningLocale: Locale; caseSensitive?: boolean }): Promise<LemmaUses> {
		if (caseSensitive) {
			return this.#searchForLemmaUsesCaseSensitive({ lemmas, learningLocale });
		}

		return this.#searchForLemmaUsesCaseInsensitive({ lemmas, learningLocale });
	}

	async #searchForLemmaUsesCaseSensitive({
		lemmas,
		learningLocale,
	}: { lemmas: string[]; learningLocale: Locale }): Promise<LemmaUses> {
		const keys = lemmas.map((lemma) => constants.keys.redis.lemmaUseIndex({ locale: learningLocale, lemma }));

		let sentenceIds: string[];
		if (keys.length === 1) {
			sentenceIds = await this.redis.smembers(keys.at(0)!);
		} else {
			sentenceIds = await this.redis.sinter(keys);
		}

		const sentencePairs = await this.getSentencePairs({ sentenceIds, learningLocale });

		return { sentencePairs, lemmas };
	}

	async #searchForLemmaUsesCaseInsensitive({
		lemmas,
		learningLocale,
	}: { lemmas: string[]; learningLocale: Locale }): Promise<LemmaUses> {
		const lemmaFormKeys = lemmas.map((lemma) =>
			constants.keys.redis.lemmaFormIndex({ locale: learningLocale, lemma }),
		);

		const pipeline = this.redis.pipeline();
		for (const lemmaFormKey of lemmaFormKeys) {
			pipeline.smembers(lemmaFormKey);
		}
		const result = await pipeline.exec();
		if (result === null || result.some(([error, _]) => error !== null)) {
			throw new Error(`Could not retrieve forms of one of the provided lemmas: ${lemmaFormKeys.join(", ")}`);
		}

		const lemmaForms = result.map(([_, lemmaForms]) => lemmaForms as string[]);
		const lemmaUseKeysAll = lemmaForms.map((lemmaForms) =>
			lemmaForms.map((lemmaForm) =>
				constants.keys.redis.lemmaUseIndex({ locale: learningLocale, lemma: lemmaForm }),
			),
		);

		const sentenceIdSets: string[][] = [];
		for (const lemmaUseKeys of lemmaUseKeysAll) {
			const pipeline = this.redis.pipeline();
			for (const lemmaUseKey of lemmaUseKeys) {
				pipeline.smembers(lemmaUseKey);
			}
			const result = await pipeline.exec();
			if (result === null || result.some(([error, _]) => error !== null)) {
				throw new Error(`Could not retrieve uses of one of the provided lemmas: ${lemmaUseKeys.join(", ")}`);
			}

			const sentenceIds = result.flatMap(([_, sentenceIds]) => sentenceIds as string[]);
			sentenceIdSets.push(sentenceIds);
		}

		let sentenceIds: string[];
		if (sentenceIdSets.length === 1) {
			sentenceIds = sentenceIdSets.at(0)!;
		} else {
			sentenceIds = Array.from(
				sentenceIdSets.reduce((sentenceIdsAll, sentenceIds) => {
					for (const sentenceId of sentenceIds) {
						sentenceIdsAll.add(sentenceId);
					}

					return sentenceIdsAll;
				}, new Set<string>()),
			);
		}

		const sentencePairs = await this.getSentencePairs({ sentenceIds, learningLocale });

		return { sentencePairs, lemmas: lemmaForms.flat() };
	}
}

export { VolatileStore };
export type { SentencePair };
