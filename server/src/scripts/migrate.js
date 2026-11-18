// Run pending server migrations without starting the API: `npm run migrate`.
import { loadConfig } from "../config.js";
import { connect } from "../db.js";
import { runMigrations } from "../migrations/index.js";

const config = loadConfig();
const { client, db } = await connect(config.mongoUri, config.dbName);
try {
  const { from, to, applied } = await runMigrations(db, { log: console.log });
  console.log(applied.length ? `Migrated ${from} -> ${to}` : `Already at schema ${to}`);
} finally {
  await client.close();
}
