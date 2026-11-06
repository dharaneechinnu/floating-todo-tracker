import { encryptedBlob } from "../schemas.js";

/*
 * The account's vault key, wrapped twice: by the vault passphrase and by
 * the recovery key. Both wrappings happen on the user's computer, so the
 * server stores a key it cannot use.
 */
const keysBody = {
  type: "object",
  required: ["kdf", "wrappedKey", "recoveryKey"],
  additionalProperties: false,
  properties: {
    kdf: {
      type: "object",
      required: ["alg", "salt"],
      properties: {
        alg: { type: "string", maxLength: 20 },
        salt: { type: "string", minLength: 8, maxLength: 100 },
      },
      maxProperties: 10,
    },
    wrappedKey: encryptedBlob(200),
    recoveryKey: encryptedBlob(200),
    // Required to replace an existing vault key (e.g. passphrase change):
    // the updatedAt you last read. Stops one computer silently replacing
    // a key another computer just changed.
    ifUpdatedAt: { type: "string", format: "date-time" },
  },
};

function present(doc) {
  return { kdf: doc.kdf, wrappedKey: doc.wrappedKey, recoveryKey: doc.recoveryKey, updatedAt: doc.updatedAt };
}

export default async function vaultRoutes(app, { db }) {
  const keys = db.collection("vault_keys");

  app.get("/v1/vault/keys", { preHandler: app.authenticate }, async (request, reply) => {
    const doc = await keys.findOne({ _id: request.userId });
    if (!doc) {
      return reply.code(404).send({ error: "no_vault", message: "This account doesn't have a vault yet." });
    }
    return present(doc);
  });

  app.put("/v1/vault/keys", { preHandler: app.authenticate, schema: { body: keysBody } }, async (request, reply) => {
    const { ifUpdatedAt, ...fields } = request.body;
    const doc = { ...fields, updatedAt: new Date() };

    if (!ifUpdatedAt) {
      try {
        await keys.insertOne({ _id: request.userId, ...doc });
        return reply.code(201).send(present(doc));
      } catch (error) {
        if (error.code !== 11000) throw error;
        return reply.code(409).send({
          error: "vault_exists",
          message: "This account already has a vault. Unlock it with its passphrase instead of creating a new one.",
        });
      }
    }

    const updated = await keys.findOneAndUpdate(
      { _id: request.userId, updatedAt: new Date(ifUpdatedAt) },
      { $set: doc },
      { returnDocument: "after" }
    );
    if (!updated) {
      return reply.code(409).send({
        error: "vault_changed",
        message: "The vault key changed on another computer. Sync, then try again.",
      });
    }
    return present(updated);
  });
}
