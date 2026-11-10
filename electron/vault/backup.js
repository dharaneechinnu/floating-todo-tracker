/*
 * The encrypted backup file ("Back up to a file" in the vault's settings).
 *
 * It is the vault's own header plus its notes, exactly as they sit in
 * vault.json: every note is still encrypted with the vault key, and the
 * vault key is still wrapped by the passphrase and by the recovery code.
 * So the file opens with the passphrase the vault had when the backup was
 * made, or with the recovery code, and is useless without one of them.
 *
 * Left out on purpose: wrong-passphrase counters, sync state and deleted
 * items. Pure functions, no Electron.
 */
const vaultCrypto = require("./crypto.js");
const items = require("./items.js");

const BACKUP_FORMAT = 1;
// Far above any real vault; stops a huge or hostile file being parsed into memory.
const MAX_BACKUP_BYTES = 64 * 1024 * 1024;

class BackupError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function buildBackup(vault, { appVersion = "", now = new Date() } = {}) {
  const kept = items.live(vault).map(({ id, kind, parentId, data, updatedAt }) => ({ id, kind, parentId, data, updatedAt }));
  return {
    app: "FocusDock",
    kind: "vault-backup",
    backupFormat: BACKUP_FORMAT,
    appVersion,
    createdAt: now.toISOString(),
    count: kept.length,
    kdf: vault.kdf,
    wrappedKey: vault.wrappedKey,
    recoveryKey: vault.recoveryKey,
    items: kept,
  };
}

function backupFileName(now = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `FocusDock vault backup ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.fdvault`;
}

const isBlob = (b) => b && typeof b === "object" && typeof b.iv === "string" && typeof b.ct === "string" && typeof b.tag === "string";

// Parse and check a backup file's text. Throws BackupError with a message
// that can be shown as-is.
function readBackup(text) {
  if (typeof text !== "string" || text.length > MAX_BACKUP_BYTES) {
    throw new BackupError("bad_backup", "That file is too large to be a FocusDock vault backup.");
  }
  let backup;
  try {
    backup = JSON.parse(text);
  } catch {
    throw new BackupError("bad_backup", "That file isn't a FocusDock vault backup.");
  }
  if (!backup || backup.kind !== "vault-backup" || !Number.isInteger(backup.backupFormat)) {
    throw new BackupError("bad_backup", "That file isn't a FocusDock vault backup.");
  }
  if (backup.backupFormat > BACKUP_FORMAT) {
    throw new BackupError("newer_backup", "This backup was made by a newer version of FocusDock. Update to restore it.");
  }
  const sound =
    backup.kdf && typeof backup.kdf.salt === "string" && typeof backup.kdf.recoverySalt === "string" &&
    isBlob(backup.wrappedKey) && isBlob(backup.recoveryKey) && Array.isArray(backup.items) &&
    backup.items.every((i) => i && typeof i.id === "string" && typeof i.kind === "string" && isBlob(i.data));
  if (!sound) throw new BackupError("bad_backup", "That backup file is damaged and can't be read.");
  return backup;
}

// True when the backup was made from the vault that `vaultKey` opens, in
// which case restoring needs no passphrase at all.
function isOwnBackup(backup, vaultKey) {
  if (!backup.items.length) return false;
  try {
    items.decrypt(vaultKey, backup.items[0]);
    return true;
  } catch {
    return false;
  }
}

// The backup's vault key, from its passphrase or its recovery code.
async function openBackupKey(backup, secret) {
  const text = String(secret || "");
  try {
    return await vaultCrypto.unlockVault(backup, text);
  } catch (error) {
    if (!(error instanceof vaultCrypto.WrongSecretError)) throw error;
  }
  try {
    return vaultCrypto.unlockWithRecoveryCode(backup, text);
  } catch {
    throw new BackupError("wrong", "That isn't this backup's passphrase or recovery code.");
  }
}

module.exports = {
  BACKUP_FORMAT,
  BackupError,
  buildBackup,
  backupFileName,
  readBackup,
  isOwnBackup,
  openBackupKey,
};
