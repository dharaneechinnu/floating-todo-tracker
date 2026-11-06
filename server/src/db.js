import { MongoClient } from "mongodb";

export async function connect(uri, dbName) {
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 10_000,
    appName: "focusdock-api",
  });
  await client.connect();
  return { client, db: client.db(dbName) };
}
