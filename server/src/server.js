import { loadConfig } from "./config.js";
import { connect } from "./db.js";
import { runMigrations } from "./migrations/index.js";
import { buildApp } from "./app.js";

const config = loadConfig();
const { client, db } = await connect(config.mongoUri, config.dbName);

// Bring the database up to this server's schema before taking traffic
// (VERSIONING.md, R6). Refuses to start against a newer database.
const result = await runMigrations(db, { log: (line) => console.log(line) });
console.log(`Database schema ${result.from} -> ${result.to}`);

const app = await buildApp({ config, db });
await app.listen({ port: config.port, host: config.host });

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.once(signal, async () => {
    await app.close();
    await client.close();
    process.exit(0);
  });
}
