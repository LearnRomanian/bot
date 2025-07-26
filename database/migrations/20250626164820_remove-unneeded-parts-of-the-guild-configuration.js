import { migrateDocuments, deleteProperties } from "../helpers.js";

// This block is executed when the migration is enacted.
async function up(database) {
	await migrateDocuments(database, {
		collection: "Guilds",
		migrate: async (document) => {
			deleteProperties(document, ["isNative", "languages"]);
			deleteProperties(document.enabledFeatures, [
				"answers",
				"corrections",
				"cefr",
				"game",
				"translate",
				"word",
				"wordSigils",
				"context",
				"roleLanguages",
			]);
			deleteProperties(document.features, ["cefr", "roleLanguages"]);
		},
	});
}

// This block is executed when the migration is rolled back.
async function down(_) {
	// No changes to make when rolling back.
}

export { up, down };
