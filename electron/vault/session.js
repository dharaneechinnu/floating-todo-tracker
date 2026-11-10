/*
 * The open vault, in the main process.
 *
 * Holds the vault key in memory only while unlocked, locks itself after a
 * stretch of inactivity, and does every read and write of vault.json. The
 * renderer only ever receives titles, or the one item it opened. Keys,
 * passphrases and the recovery code never cross IPC, except the recovery
 * code once, right after setup, so it can be shown.
 *
 * Everything Electron-specific (clipboard, timers, clock) is passed in, so
 * this can be tested in plain Node.
 */
const vaultCrypto = require("./crypto.js");
const vaultFile = require("./file.js");
const items = require("./items.js");
const backups = require("./backup.js");

const AUTO_LOCK_MS = 5 * 60 * 1000;
const CLIPBOARD_CLEAR_MS = 30 * 1000;
const MIN_PASSPHRASE = 10;
const COPYABLE = new Set(["username", "password", "url"]);

// What the renderer may write into an item, and how long each field may be.
const CONTENT_LIMITS = { title: 200, body: 20000, username: 500, password: 1000, url: 2000, color: 20 };

function cleanContent(input) {
  const out = {};
  if (!input || typeof input !== "object") return out;
  for (const [field, max] of Object.entries(CONTENT_LIMITS)) {
    if (input[field] === undefined) continue;
    out[field] = String(input[field]).slice(0, max);
  }
  return out;
}

class VaultError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.code = code;
    Object.assign(this, extra);
  }
}

function createVaultSession({
  filePath,
  clipboard,
  kdf = vaultCrypto.DEFAULT_KDF,
  autoLockMs = AUTO_LOCK_MS,
  clipboardClearMs = CLIPBOARD_CLEAR_MS,
  now = () => Date.now(),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  onLock = () => {},
  // Called after the user changes something that sync should upload.
  onChange = () => {},
  appVersion = "",
}) {
  let data = null; // vault.json contents
  let key = null; // vault key, only while unlocked
  let idleTimer = null;
  let clipboardTimer = null;
  let newer = false;

  function load() {
    try {
      data = vaultFile.readVault(filePath);
      newer = false;
    } catch (error) {
      if (error instanceof vaultFile.NewerVaultError) {
        newer = true;
        data = null;
        return;
      }
      throw error;
    }
  }

  // `quiet` is for writes sync itself makes: they must not ask for
  // another sync, or a sync that can't finish would retry forever.
  function save(next, { quiet = false } = {}) {
    vaultFile.writeVault(filePath, next);
    data = next;
    if (!quiet) onChange();
  }

  function armIdleTimer() {
    if (idleTimer) clearTimer(idleTimer);
    idleTimer = setTimer(() => lock("idle"), autoLockMs);
  }

  function requireUnlocked() {
    if (!key) throw new VaultError("locked", "The vault is locked.");
    armIdleTimer(); // any use of the vault counts as activity
  }

  function status() {
    if (newer) return { state: "newer" };
    if (!data) return { state: "none" };
    const waitMs = Math.max(0, (data.lockedUntil || 0) - now());
    return {
      state: key ? "unlocked" : "locked",
      waitMs,
      autoLockMinutes: Math.round(autoLockMs / 60000),
    };
  }

  function checkPassphrase(passphrase) {
    if (typeof passphrase !== "string" || passphrase.trim().length < MIN_PASSPHRASE) {
      throw new VaultError("weak", `Use at least ${MIN_PASSPHRASE} characters. A few random words work well.`);
    }
  }

  async function create(passphrase) {
    if (newer) throw new VaultError("newer", "This vault was saved by a newer version of FocusDock.");
    if (data) throw new VaultError("exists", "A vault already exists on this computer.");
    checkPassphrase(passphrase);
    const made = await vaultCrypto.createVault(passphrase, kdf);
    save(vaultFile.emptyVault(made.header));
    key = made.vaultKey;
    armIdleTimer();
    return { recoveryCode: made.recoveryCode };
  }

  function guardWait() {
    const waitMs = Math.max(0, (data.lockedUntil || 0) - now());
    if (waitMs > 0) {
      throw new VaultError("wait", `Too many wrong tries. Wait ${Math.ceil(waitMs / 1000)} seconds.`, { waitMs });
    }
  }

  async function unlock(passphrase) {
    if (!data) throw new VaultError("none", "There is no vault on this computer yet.");
    guardWait();
    try {
      key = await vaultCrypto.unlockVault(data, String(passphrase || ""));
    } catch (error) {
      if (!(error instanceof vaultCrypto.WrongSecretError)) throw error;
      save(vaultFile.recordFailedUnlock(data, now()));
      const waitMs = Math.max(0, data.lockedUntil - now());
      throw new VaultError("wrong", "That passphrase isn't right.", { waitMs });
    }
    if (data.failedUnlocks) save(vaultFile.recordSuccessfulUnlock(data));
    armIdleTimer();
    return status();
  }

  // Forgot the passphrase: the recovery code opens the vault and a new
  // passphrase is set straight away.
  async function recover(recoveryCode, newPassphrase) {
    if (!data) throw new VaultError("none", "There is no vault on this computer yet.");
    guardWait();
    checkPassphrase(newPassphrase);
    let vaultKey;
    try {
      vaultKey = vaultCrypto.unlockWithRecoveryCode(data, recoveryCode);
    } catch (error) {
      if (!(error instanceof vaultCrypto.WrongSecretError)) throw error;
      save(vaultFile.recordFailedUnlock(data, now()));
      throw new VaultError("wrong", "That recovery code isn't right.", { waitMs: Math.max(0, data.lockedUntil - now()) });
    }
    const header = await vaultCrypto.rewrapWithPassphrase(data, vaultKey, newPassphrase);
    key = vaultKey;
    save(vaultFile.recordSuccessfulUnlock(withNewWrapping(header)));
    armIdleTimer();
    return status();
  }

  // The passphrase wrapping changed. If this vault is on an account, the
  // account's copy of the wrapped key has to follow at the next sync.
  function withNewWrapping(header) {
    const sync = data.sync && data.sync.userId ? { ...data.sync, keysDirty: true } : data.sync;
    return { ...data, kdf: header.kdf, wrappedKey: header.wrappedKey, sync };
  }

  /*
   * Change the passphrase from inside the open vault. Asks for the current
   * one again, so someone who finds the vault left open can't lock its
   * owner out. Only the wrapping of the vault key changes: no note is
   * re-encrypted and the recovery code stays the same.
   */
  async function changePassphrase(current, next) {
    requireUnlocked();
    checkPassphrase(next);
    try {
      (await vaultCrypto.unlockVault(data, String(current || ""))).fill(0);
    } catch (error) {
      if (!(error instanceof vaultCrypto.WrongSecretError)) throw error;
      throw new VaultError("wrong", "Your current passphrase isn't right.");
    }
    if (String(current) === String(next)) {
      throw new VaultError("same", "That's already your passphrase. Pick a different one.");
    }
    requireUnlocked(); // it may have locked while the check above was running
    const header = await vaultCrypto.rewrapWithPassphrase(data, key, next);
    requireUnlocked();
    save(withNewWrapping(header));
    return status();
  }

  /* ---------- backup file ---------- */

  function exportBackup() {
    requireUnlocked();
    return backups.buildBackup(data, { appVersion, now: new Date(now()) });
  }

  // What the restore screen needs to know before asking for anything.
  function inspectBackup(backup) {
    requireUnlocked();
    return {
      createdAt: backup.createdAt || null,
      count: backup.items.length,
      needsSecret: backup.items.length > 0 && !backups.isOwnBackup(backup, key),
    };
  }

  /*
   * Bring a backup's notes into the open vault. A backup of this vault
   * needs nothing more; one from another vault needs that vault's
   * passphrase or recovery code. Nothing already in the vault is replaced.
   */
  async function importBackup(backup, secret) {
    requireUnlocked();
    if (!backup.items.length) return { restored: 0, skipped: 0 };
    let result;
    if (backups.isOwnBackup(backup, key)) {
      result = items.restoreItems(data, key, backup.items, now());
    } else {
      const backupKey = await backups.openBackupKey(backup, secret);
      requireUnlocked();
      try {
        result = backupKey.equals(key)
          ? items.restoreItems(data, key, backup.items, now())
          : items.copyItemsInto(data, key, backup.items, backupKey, now());
      } finally {
        backupKey.fill(0);
      }
    }
    if (result.restored) save(result.vault);
    return { restored: result.restored, skipped: result.skipped };
  }

  /* ---------- for sync (electron/vault/sync.js) ---------- */

  /*
   * Replace this computer's vault with the account's: `header` and
   * `vaultKey` come from the server's wrapped key, opened with that
   * vault's passphrase. Notes already on this computer are re-encrypted
   * into the account's vault so nothing is left behind, and the old file
   * is kept next to the new one as vault.before-account.<date>.json.
   */
  function adopt(header, vaultKey, sync) {
    if (newer) throw new VaultError("newer", "This vault was saved by a newer version of FocusDock.");
    let next = { ...vaultFile.emptyVault(header), sync };
    let carried = 0;
    if (data) {
      if (!key) throw new VaultError("locked", "Unlock this computer's vault first, so its notes can come along.");
      const copied = items.copyItemsInto(next, vaultKey, data.items, key, now());
      next = copied.vault;
      carried = copied.restored;
      vaultFile.archiveVault(filePath, "before-account", now());
      key.fill(0);
    }
    key = Buffer.from(vaultKey);
    save(next, { quiet: true });
    armIdleTimer();
    return { carried };
  }

  // Sync's own access. Unlike the calls above it does not count as
  // activity, so background syncing never keeps the vault unlocked.
  const forSync = {
    data: () => data,
    unlocked: () => Boolean(key),
    write(fn) {
      if (!key) throw new VaultError("locked", "The vault is locked.");
      const next = fn(data, key);
      if (next && next !== data) save(next, { quiet: true });
      return data;
    },
    adopt,
  };

  let copiedValue = null; // what copy() last put on the clipboard

  // Wipe the clipboard, but only if it still holds what the vault put
  // there: never erase something the user copied from elsewhere since.
  function wipeClipboard() {
    if (clipboardTimer) clearTimer(clipboardTimer);
    clipboardTimer = null;
    if (copiedValue !== null && clipboard.readText() === copiedValue) clipboard.writeText("");
    copiedValue = null;
  }

  /*
   * Locking also wipes a copied secret. Quitting locks the vault, so this
   * covers quitting within the 30 seconds too, when the timer would never
   * get to run.
   */
  function lock(reason = "manual") {
    wipeClipboard();
    const wasUnlocked = Boolean(key);
    if (key) key.fill(0);
    key = null;
    if (idleTimer) clearTimer(idleTimer);
    idleTimer = null;
    if (wasUnlocked) onLock(reason);
    return status();
  }

  function list() {
    requireUnlocked();
    return items.listItems(data, key);
  }

  function open(id) {
    requireUnlocked();
    const item = data.items.find((i) => i.id === id && !i.deleted);
    if (!item) throw new VaultError("missing", "That item no longer exists.");
    return { id: item.id, kind: item.kind, parentId: item.parentId, updatedAt: item.updatedAt, content: items.decrypt(key, item) };
  }

  function add({ kind, parentId, content }) {
    requireUnlocked();
    const result = items.createItem(data, key, { kind, parentId, content: cleanContent(content) }, now());
    save(result.vault);
    return result.item.id;
  }

  function update(id, changes) {
    requireUnlocked();
    save(items.updateItem(data, key, id, cleanContent(changes), now()));
    return open(id);
  }

  function remove(id) {
    requireUnlocked();
    save(items.deleteItem(data, key, id, now()));
  }

  /*
   * Copy a username, password or URL. The value goes from here straight to
   * the system clipboard, without passing through the renderer, and is
   * wiped after 30 seconds or when the vault locks, whichever comes first,
   * unless the user has copied something else since.
   */
  function copy(id, field) {
    if (!COPYABLE.has(field)) throw new VaultError("bad_field", "That field can't be copied.");
    const { content } = open(id);
    const value = String(content[field] || "");
    if (!value) throw new VaultError("empty", "There's nothing to copy.");
    wipeClipboard();
    clipboard.writeText(value);
    copiedValue = value;
    clipboardTimer = setTimer(wipeClipboard, clipboardClearMs);
    return { clearsInMs: clipboardClearMs };
  }

  load();
  return {
    status, create, unlock, recover, lock, list, open, add, update, remove, copy,
    changePassphrase, exportBackup, inspectBackup, importBackup,
    forSync, reload: load,
  };
}

module.exports = { createVaultSession, VaultError, MIN_PASSPHRASE, AUTO_LOCK_MS, CLIPBOARD_CLEAR_MS };
