const fs = require("fs");
const path = require("path");

const KEEP_BACKUPS = 5;

/*
 * Copy the data file aside before it is migrated (rule R2), keeping the
 * newest KEEP_BACKUPS copies. Names sort by time:
 *   backups/config.v1.2026-11-06T08-15-00-000Z.json
 */
function backupFile(filePath, fromVersion, now = new Date()) {
  if (!fs.existsSync(filePath)) return null;
  const dir = path.join(path.dirname(filePath), "backups");
  fs.mkdirSync(dir, { recursive: true });

  const base = path.basename(filePath, path.extname(filePath));
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const target = path.join(dir, `${base}.v${fromVersion}.${stamp}.json`);
  fs.copyFileSync(filePath, target);

  pruneBackups(dir, base);
  return target;
}

function pruneBackups(dir, base, keep = KEEP_BACKUPS) {
  const ours = fs
    .readdirSync(dir)
    .filter((name) => name.startsWith(`${base}.v`) && name.endsWith(".json"))
    .map((name) => ({ name, time: name.slice(name.indexOf(".", base.length + 2) + 1) }))
    .sort((a, b) => (a.time < b.time ? 1 : -1));
  for (const old of ours.slice(keep)) fs.unlinkSync(path.join(dir, old.name));
}

module.exports = { backupFile, pruneBackups, KEEP_BACKUPS };
