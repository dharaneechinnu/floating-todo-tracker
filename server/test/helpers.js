import { randomBytes } from "node:crypto";
import { MongoClient } from "mongodb";
import { loadConfig } from "../src/config.js";
import { runMigrations } from "../src/migrations/index.js";
import { buildApp } from "../src/app.js";

// Tests need a real MongoDB: locally `docker run -d -p 27017:27017 mongo:7`,
// in CI the workflow's mongo service.
export const TEST_URI = process.env.MONGODB_URI_TEST || "mongodb://127.0.0.1:27017";

export async function freshDatabase() {
  const client = new MongoClient(TEST_URI, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  const db = client.db(`focusdock_test_${randomBytes(4).toString("hex")}`);
  return {
    client,
    db,
    async drop() {
      await db.dropDatabase();
      await client.close();
    },
  };
}

export function testConfig(overrides = {}) {
  return {
    ...loadConfig({
      MONGODB_URI: TEST_URI,
      JWT_SECRET: "test-secret-that-is-definitely-longer-than-32-chars",
      AUTH_RATE_LIMIT_MAX: "1000",
      TRUST_PROXY: "false",
    }),
    ...overrides,
  };
}

export async function testApp(db, overrides) {
  await runMigrations(db);
  return buildApp({ config: testConfig(overrides), db, logger: false });
}
