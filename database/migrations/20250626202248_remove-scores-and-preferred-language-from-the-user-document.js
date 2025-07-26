import { migrateDocuments, deleteProperty } from "../helpers.js";

// This block is executed when the migration is enacted.
async function up(database) {
	await migrateDocuments(database, {
		collection: "Users",
		migrate: async (document) => {
			deleteProperty(document, "scores");
			deleteProperty(document.account, "language");
		},
	});
}

// This block is executed when the migration is rolled back.
async function down(_) {
	// No changes to make when rolling back.
}

export { up, down };
