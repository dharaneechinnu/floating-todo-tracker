import { encryptedBlob, UUID_PATTERN } from "../schemas.js";
import { LockBusyError, withUserLock } from "../sync/userLock.js";

export const MAX_PUSH = 200;
export const MAX_PULL = 500;

const item = {
  type: "object",
  required: ["id", "kind", "data", "rev", "deleted"],
  additionalProperties: false,
  properties: {
    id: { type: "string", pattern: UUID_PATTERN },
    // Unknown kinds are stored and returned as-is (VERSIONING.md, R4), so
    // a newer app can add one without a server change.
    kind: { type: "string", minLength: 1, maxLength: 20, pattern: "^[a-z][a-z0-9_-]*$" },
    parentId: { anyOf: [{ type: "string", pattern: UUID_PATTERN }, { type: "null" }] },
    data: encryptedBlob(96 * 1024),
    rev: { type: "integer", minimum: 1 },
    deleted: { type: "boolean" },
  },
};

const pushBody = {
  type: "object",
  required: ["items"],
  additionalProperties: false,
  properties: { items: { type: "array", minItems: 1, maxItems: MAX_PUSH, items: item } },
};

const pullQuery = {
  type: "object",
  properties: {
    since: { type: "integer", minimum: 0, default: 0 },
    limit: { type: "integer", minimum: 1, maximum: MAX_PULL, default: MAX_PULL },
  },
};

function present(doc) {
  return {
    id: doc._id,
    kind: doc.kind,
    parentId: doc.parentId ?? null,
    data: doc.data,
    rev: doc.rev,
    deleted: doc.deleted,
    seq: doc.seq,
    updatedAt: doc.updatedAt,
  };
}

/*
 * Sync is "newest rev wins, per item". The server can't read items, so it
 * can't merge them; it only refuses to replace a copy with an older or
 * equal rev. The app turns a refused item into a conflict copy, so a
 * secret never disappears without the user seeing it.
 */
export default async function syncRoutes(app, { db }) {
  const items = db.collection("vault_items");
  const keys = db.collection("vault_keys");

  app.post("/v1/sync/push", { preHandler: app.authenticate, schema: { body: pushBody } }, async (request, reply) => {
    const { userId } = request;

    // Items are encrypted with the account's vault key, so that key has to
    // exist first. Otherwise nothing could ever decrypt what's pushed.
    if (!(await keys.findOne({ _id: userId }, { projection: { _id: 1 } }))) {
      return reply.code(409).send({ error: "no_vault", message: "Set up the vault on this account before syncing." });
    }

    const ids = request.body.items.map((i) => i.id);
    if (new Set(ids).size !== ids.length) {
      return reply.code(400).send({ error: "duplicate_items", message: "Each item can appear only once per push." });
    }

    try {
      return await withUserLock(db, userId, async (startSeq) => {
        let seq = startSeq;
        const accepted = [];
        const conflicts = [];

        // Saved even if a later item throws, so the numbers already used
        // are never handed out twice.
        try {
          for (const incoming of request.body.items) {
            const next = seq + 1;
            try {
              await items.updateOne(
                { _id: incoming.id, userId, rev: { $lt: incoming.rev } },
                {
                  $set: {
                    userId,
                    kind: incoming.kind,
                    parentId: incoming.parentId ?? null,
                    data: incoming.data,
                    rev: incoming.rev,
                    deleted: incoming.deleted,
                    seq: next,
                    updatedAt: new Date(),
                  },
                },
                { upsert: true }
              );
              seq = next;
              accepted.push({ id: incoming.id, rev: incoming.rev, seq: next });
            } catch (error) {
              // Duplicate _id: the item exists with an equal or newer rev
              // (or, practically never, the UUID belongs to someone else).
              if (error.code !== 11000) throw error;
              const current = await items.findOne({ _id: incoming.id, userId }, { projection: { rev: 1 } });
              conflicts.push({ id: incoming.id, serverRev: current ? current.rev : null });
            }
          }
        } finally {
          await db.collection("counters").updateOne({ _id: userId }, { $set: { seq } });
        }
        return { accepted, conflicts, cursor: seq };
      });
    } catch (error) {
      if (error instanceof LockBusyError) {
        return reply.code(503).send({ error: "sync_busy", message: "Another sync is still running. Try again in a moment." });
      }
      throw error;
    }
  });

  app.get("/v1/sync/pull", { preHandler: app.authenticate, schema: { querystring: pullQuery } }, async (request) => {
    const { since, limit } = request.query;
    const page = await items
      .find({ userId: request.userId, seq: { $gt: since } })
      .sort({ seq: 1 })
      .limit(limit + 1)
      .toArray();

    const more = page.length > limit;
    const batch = more ? page.slice(0, limit) : page;
    return {
      items: batch.map(present),
      cursor: batch.length ? batch[batch.length - 1].seq : since,
      more,
    };
  });
}
