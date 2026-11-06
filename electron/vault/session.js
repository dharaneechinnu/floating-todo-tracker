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

  function save(next) {
    vaultFile.writeVault(filePath, next);
    data = next;
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
    save(vaultFile.recordSuccessfulUnlock({ ...data, kdf: header.kdf, wrappedKey: header.wrappedKey }));
    key = vaultKey;
    armIdleTimer();
    return status();
  }

  function lock(reason = "manual") {
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
   * wiped after 30 seconds unless the user has copied something else.
   */
  function copy(id, field) {
    if (!COPYABLE.has(field)) throw new VaultError("bad_field", "That field can't be copied.");
    const { content } = open(id);
    const value = String(content[field] || "");
    if (!value) throw new VaultError("empty", "There's nothing to copy.");
    clipboard.writeText(value);
    if (clipboardTimer) clearTimer(clipboardTimer);
    clipboardTimer = setTimer(() => {
      if (clipboard.readText() === value) clipboard.writeText("");
      clipboardTimer = null;
    }, clipboardClearMs);
    return { clearsInMs: clipboardClearMs };
  }

  load();
  return { status, create, unlock, recover, lock, list, open, add, update, remove, copy, reload: load };
}

module.exports = { createVaultSession, VaultError, MIN_PASSPHRASE, AUTO_LOCK_MS, CLIPBOARD_CLEAR_MS };
