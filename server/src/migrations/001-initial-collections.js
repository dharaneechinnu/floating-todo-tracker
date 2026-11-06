/*
 * Server schema 1: every collection the API needs, with validators and
 * indexes.
 *
 * Validators require the fields each document must have and check their
 * types, but allow extra fields (VERSIONING.md, R4) so a newer server can
 * add fields without first loosening the validator.
 *
 * Content is never readable here: vault items arrive already encrypted by
 * the desktop app (`iv`, `ct`, `tag`), and wrapped keys are encrypted by a
 * passphrase the server never sees.
 */
const str = { bsonType: "string" };
const date = { bsonType: "date" };
const encrypted = {
  bsonType: "object",
  required: ["v", "iv", "ct", "tag"],
  properties: { v: { bsonType: "int" }, iv: str, ct: str, tag: str },
};

const COLLECTIONS = {
  users: {
    required: ["_id", "email", "passwordHash", "createdAt"],
    properties: { _id: str, email: str, passwordHash: str, createdAt: date },
  },
  sessions: {
    required: ["_id", "userId", "tokenHash", "family", "createdAt", "expiresAt"],
    properties: {
      _id: str,
      userId: str,
      tokenHash: str,
      family: str,
      device: str,
      createdAt: date,
      expiresAt: date,
      rotatedAt: { bsonType: ["date", "null"] },
    },
  },
  vault_keys: {
    required: ["_id", "kdf", "wrappedKey", "recoveryKey", "updatedAt"],
    properties: {
      _id: str, // the user's id: one vault per account
      kdf: { bsonType: "object" },
      wrappedKey: encrypted,
      recoveryKey: encrypted,
      updatedAt: date,
    },
  },
  vault_items: {
    required: ["_id", "userId", "kind", "data", "rev", "deleted", "seq", "updatedAt"],
    properties: {
      _id: str, // UUID made by the desktop app
      userId: str,
      kind: str, // "section" | "note" | later "todo"; unknown kinds are kept
      parentId: { bsonType: ["string", "null"] },
      data: encrypted,
      rev: { bsonType: ["int", "long"] },
      deleted: { bsonType: "bool" },
      seq: { bsonType: ["int", "long"] },
      updatedAt: date,
    },
  },
  counters: {
    // Per-user change counter; vault_items.seq comes from here.
    required: ["_id", "seq"],
    properties: { _id: str, seq: { bsonType: ["int", "long"] } },
  },
};

async function ensureCollection(db, name, schema) {
  const validator = { $jsonSchema: { bsonType: "object", ...schema } };
  const exists = await db.listCollections({ name }, { nameOnly: true }).hasNext();
  if (exists) {
    await db.command({ collMod: name, validator, validationLevel: "strict", validationAction: "error" });
  } else {
    await db.createCollection(name, { validator, validationLevel: "strict", validationAction: "error" });
  }
}

export default {
  version: 1,
  description: "Create users, sessions, vault_keys, vault_items and counters",
  async up(db) {
    for (const [name, schema] of Object.entries(COLLECTIONS)) {
      await ensureCollection(db, name, schema);
    }

    await db.collection("users").createIndex({ email: 1 }, { unique: true, name: "email_unique" });

    const sessions = db.collection("sessions");
    await sessions.createIndex({ tokenHash: 1 }, { unique: true, name: "token_unique" });
    await sessions.createIndex({ userId: 1 }, { name: "by_user" });
    // MongoDB deletes expired sessions on its own.
    await sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "expire" });

    const items = db.collection("vault_items");
    // Pull: "everything for this user changed after cursor N".
    await items.createIndex({ userId: 1, seq: 1 }, { unique: true, name: "pull_cursor" });
    await items.createIndex({ userId: 1, parentId: 1 }, { name: "by_parent" });
  },
};
