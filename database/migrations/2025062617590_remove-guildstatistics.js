import { migrateDocuments } from "../helpers.js";

// This block is executed when the migration is enacted.
async function up(database) {
	await migrateDocuments(database, {
		collection: "GuildStatistics",
		migrate: async (document) => document.delete(database),
	});
}

// This block is executed when the migration is rolled back.
async function down(_) {
	// No changes to make when rolling back.
}

export { up, down };
