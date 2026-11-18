/*
 * Data migration runner — see VERSIONING.md.
 *
 * Every persisted file carries an integer `schemaVersion`. On startup the
 * file is brought up to the latest version *before* any feature code reads
 * it, so main.js never has to cope with an old shape (rule R1).
 *
 * This module is pure: it takes data in and returns data out, and never
 * touches the disk. Backups and the actual write live in store.js, which
 * keeps this easy to test against fixtures (rule R7).
 *
 * Migrations are never edited after they ship. To change shape again, add
 * a new numbered file.
 */

function validateMigrations(migrations) {
  migrations.forEach((m, index) => {
    if (m.version !== index + 1) {
      throw new Error(
        `Migration list is out of order: expected version ${index + 1}, found ${m.version}`
      );
    }
    if (typeof m.up !== "function") {
      throw new Error(`Migration ${m.version} has no up() function`);
    }
  });
  return migrations.length;
}

/*
 * Returns { status, from, to, data }.
 *   "current"  — already at the latest version, data returned untouched
 *   "migrated" — data is a new object at the latest version
 *   "newer"    — written by a newer FocusDock; caller must not write (R3)
 *   "failed"   — a migration threw; data is the untouched original and
 *                `error` says why. Caller must not write.
 *
 * The input is never mutated, so a failure part-way through can't leave
 * the in-memory copy half-migrated.
 */
function migrate(data, migrations) {
  const latest = validateMigrations(migrations);
  const source = data && typeof data === "object" ? data : {};
  const from = Number.isInteger(source.schemaVersion) ? source.schemaVersion : 0;

  if (from > latest) return { status: "newer", from, to: latest, data: source };
  if (from === latest) return { status: "current", from, to: latest, data: source };

  let next = structuredClone(source);
  try {
    for (const m of migrations) {
      if (m.version <= from) continue;
      const result = m.up(next);
      next = result && typeof result === "object" ? result : next;
      next.schemaVersion = m.version;
    }
  } catch (error) {
    return { status: "failed", from, to: latest, data: source, error };
  }
  return { status: "migrated", from, to: latest, data: next };
}

module.exports = { migrate, validateMigrations };
