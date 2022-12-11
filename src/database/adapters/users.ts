import * as Fauna from 'fauna';
import { User } from 'logos/src/database/structs/mod.ts';
import {
	CacheAdapter,
	DatabaseAdapters,
	dispatchQuery,
	getUserMentionByReference,
	mentionUser,
	stringifyValue,
} from 'logos/src/database/database.ts';
import { Document } from 'logos/src/database/document.ts';
import { UserIndexes, userIndexParameterToIndex } from 'logos/src/database/indexes.ts';

const $ = Fauna.query;

const cache: CacheAdapter<User, UserIndexes<Document<User>>> = {
	get: (client, parameter, value) => {
		if (parameter === 'reference') {
			return client.database.cache.usersByReference.get(value);
		}

		return client.database.cache.usersById.get(value);
	},
	set: (client, parameter, value, user) => {
		if (parameter === 'reference') {
			client.database.cache.usersByReference.set(value, user);
			return;
		}

		client.database.cache.usersById.set(value, user);
	},
};

const adapter: DatabaseAdapters['users'] = {
	fetch: async (client, parameter, parameterValue) => {
		const value = stringifyValue(parameterValue);

		let query: Fauna.Expr;
		if (parameter === 'reference') {
			query = $.Get(parameterValue as Fauna.values.Ref);
		} else {
			const index = userIndexParameterToIndex[parameter as Exclude<typeof parameter, 'reference'>];
			query = $.Get($.Match(index, parameterValue as Fauna.ExprVal));
		}

		const document = await dispatchQuery<User>(client, query);
		if (document === undefined) {
			client.log.debug(`Couldn't find a user in the database whose '${parameter}' matches '${value}'.`);
			return undefined;
		}

		const referenceId = stringifyValue(document.ref);
		const id = document.data.account.id;

		cache.set(client, 'reference', referenceId, document);
		cache.set(client, 'id', id, document);

		const userMention = getUserMentionByReference(client, document.ref);
		client.log.debug(`Fetched user document for ${userMention}.`);

		return cache.get(client, parameter, value);
	},
	getOrFetchOrCreate: async (client, parameter, parameterValue, id) => {
		const value = stringifyValue(parameterValue);

		return cache.get(client, parameter, value) ?? await adapter.fetch(client, parameter, parameterValue) ??
			adapter.create(client, { account: { id: `${id}` } });
	},
	create: async (client, user) => {
		const document = await dispatchQuery<User>(client, $.Create($.Collection('Users'), { data: user }));

		const idAsNumber = BigInt(user.account.id);
		const user_ = client.cache.users.get(idAsNumber);
		const userMention = mentionUser(user_, idAsNumber);

		if (document === undefined) {
			client.log.error(`Failed to create a user document in the database for ${userMention}.`);
			return undefined;
		}

		const referenceId = stringifyValue(document.ref);
		const id = user.account.id;

		cache.set(client, 'reference', referenceId, document);
		cache.set(client, 'id', id, document);

		client.log.debug(`Created user document for ${userMention}.`);

		return document;
	},
};

export default adapter;
