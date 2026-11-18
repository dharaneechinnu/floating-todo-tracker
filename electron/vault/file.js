/*
 * vault.json on disk. Everything secret inside is already encrypted by
 * crypto.js; this module only reads and writes the file safely.
 *
 * - Writes go to a temp file that then replaces the real one, so a crash
 *   mid-save leaves the previous version intact.
 * - The previous 3 versions are kept as vault.json.1 … .3.
 * - Wrong-passphrase attempts are counted in the file, so restarting the
 *   app doesn't reset the waiting time.
 */
const fs = require("fs");
const path = require("path");

const VAULT_FORMAT = 1;
const KEEP_VERSIONS = 3;
const FREE_ATTEMPTS = 5;
const MAX_WAIT_MS = 60_000;

class NewerVaultError extends Error {}

function emptyVault(header) {
  return {
    format: VAULT_FORMAT,
    ...header,
    failedUnlocks: 0,
    lockedUntil: 0,
    items: [],
    sync: { userId: null, cursor: 0, lastSyncAt: null },
  };
}

function readVault(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!Number.isInteger(data.format) || data.format > VAULT_FORMAT) {
    // VERSIONING.md R3: never write over a vault a newer FocusDock made.
    throw new NewerVaultError("This vault was saved by a newer version of FocusDock. Update to open it.");
  }
  return data;
}

function writeVault(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });

  if (fs.existsSync(filePath)) {
    for (let i = KEEP_VERSIONS; i >= 1; i -= 1) {
      const from = i === 1 ? filePath : `${filePath}.${i - 1}`;
      if (fs.existsSync(from)) fs.copyFileSync(from, `${filePath}.${i}`);
    }
  }
  fs.renameSync(tmp, filePath);
}

// How long the user must wait before trying again, in ms (0 = no wait).
function unlockWaitMs(failedUnlocks) {
  if (failedUnlocks < FREE_ATTEMPTS) return 0;
  return Math.min(MAX_WAIT_MS, 2000 * 2 ** (failedUnlocks - FREE_ATTEMPTS));
}

function recordFailedUnlock(data, now = Date.now()) {
  const failedUnlocks = (data.failedUnlocks || 0) + 1;
  return { ...data, failedUnlocks, lockedUntil: now + unlockWaitMs(failedUnlocks) };
}

function recordSuccessfulUnlock(data) {
  return { ...data, failedUnlocks: 0, lockedUntil: 0 };
}

module.exports = {
  VAULT_FORMAT,
  KEEP_VERSIONS,
  NewerVaultError,
  emptyVault,
  readVault,
  writeVault,
  unlockWaitMs,
  recordFailedUnlock,
  recordSuccessfulUnlock,
};
