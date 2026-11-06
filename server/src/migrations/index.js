/*
 * Server schema migrations (VERSIONING.md). Same idea as the desktop app's
 * runner: integer versions, applied in order, never edited after they ship.
 *
 * Applied versions are recorded in the `migrations` collection. A lock
 * document in `migrations_lock` stops two server instances from migrating
 * at the same time during a rolling deploy.
 */
import m001 from "./001-initial-collections.js";

export const MIGRATIONS = [m001];

const LOCK_ID = "schema";
const STALE_LOCK_MS = 10 * 60 * 1000;

export class NewerDatabaseError extends Error {}

export function validateMigrations(migrations) {
  migrations.forEach((m, index) => {
    if (m.version !== index + 1) {
      throw new Error(`Server migrations out of order: expected ${index + 1}, found ${m.version}`);
    }
    if (typeof m.up !== "function") throw new Error(`Migration ${m.version} has no up()`);
  });
  return migrations.length;
}

async function acquireLock(db, { timeoutMs = 60_000, pollMs = 250 } = {}) {
  const locks = db.collection("migrations_lock");
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      await locks.insertOne({ _id: LOCK_ID, lockedAt: new Date() });
      return;
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
    // A crashed instance can leave the lock behind; take it over once stale.
    await locks.deleteOne({ _id: LOCK_ID, lockedAt: { $lt: new Date(Date.now() - STALE_LOCK_MS) } });
    if (Date.now() > deadline) throw new Error("Timed out waiting for the migration lock");
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

async function releaseLock(db) {
  await db.collection("migrations_lock").deleteOne({ _id: LOCK_ID });
}

export async function currentSchemaVersion(db) {
  const latest = await db.collection("migrations").find().sort({ _id: -1 }).limit(1).next();
  return latest ? latest._id : 0;
}

export async function runMigrations(db, { migrations = MIGRATIONS, log = () => {} } = {}) {
  const latest = validateMigrations(migrations);
  await acquireLock(db);
  try {
    const from = await currentSchemaVersion(db);
    if (from > latest) {
      throw new NewerDatabaseError(
        `Database schema is version ${from}, but this server only knows up to ${latest}. Deploy the newer server.`
      );
    }
    const applied = [];
    for (const m of migrations) {
      if (m.version <= from) continue;
      log(`Applying server migration ${m.version}: ${m.description}`);
      await m.up(db);
      await db.collection("migrations").insertOne({
        _id: m.version,
        description: m.description,
        appliedAt: new Date(),
      });
      applied.push(m.version);
    }
    return { from, to: latest, applied };
  } finally {
    await releaseLock(db);
  }
}
