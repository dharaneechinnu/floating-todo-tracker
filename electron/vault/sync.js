/*
 * Vault sync: keeps the vault on this computer and the copy on the
 * account in step. Main process only.
 *
 * The server never sees a passphrase, a vault key or a readable note. It
 * stores the vault key wrapped by the passphrase (and by the recovery
 * code), and each item as ciphertext with a revision number. Sync is
 * "newest revision wins, per item"; when two computers edited the same
 * note, items.applyRemote keeps both, one as "(conflict copy)".
 *
 * Three ways in:
 *   link()      this computer's vault goes onto an account with no vault
 *   join()      the account's vault comes to this computer (notes already
 *               here are carried into it)
 *   syncNow()   push what changed here, pull what changed elsewhere
 *
 * `session` is the vault session and `client` the sync client, both passed
 * in, so two "computers" can be run against one server in a test.
 */
const vaultCrypto = require("./crypto.js");
const items = require("./items.js");
const { SyncError } = require("../sync/client.js");

const PUSH_CHUNK = 100; // the server takes up to 200 per push
// A push can be refused (conflict), the pull then makes conflict copies,
// and those need one more push. Three rounds settles every real case.
const MAX_ROUNDS = 3;

const headerOf = (v) => ({ kdf: v.kdf, wrappedKey: v.wrappedKey, recoveryKey: v.recoveryKey });
const sameBlob = (a, b) => Boolean(a && b) && a.iv === b.iv && a.ct === b.ct && a.tag === b.tag;
/*
 * The recovery-code wrapping is made once, when a vault is created, and a
 * passphrase change never touches it. So two headers with the same one
 * are the same vault, whatever their passphrase wrapping says.
 */
const sameVault = (a, b) => sameBlob(a.recoveryKey, b.recoveryKey);

function createVaultSync({ session, client, now = () => Date.now(), onState = () => {} }) {
  const vault = session.forSync;
  let running = null;
  let queued = false;
  let lastError = null;
  let lastResult = null; // { conflictCopies, pulled, passphraseChanged }

  function linked() {
    const account = client.account();
    const data = vault.data();
    return Boolean(account && data && data.sync && data.sync.userId === account.id);
  }

  function status() {
    const account = client.account();
    const data = vault.data();
    return {
      account,
      serverUrl: client.serverUrl(),
      linked: linked(),
      // This vault syncs with an account, but nobody is signed in: the
      // session ended, or this computer couldn't keep the sign-in.
      needsSignIn: Boolean(!account && data && data.sync && data.sync.userId),
      syncing: Boolean(running),
      lastSyncAt: linked() ? data.sync.lastSyncAt || null : null,
      pending: linked() ? items.pendingPush(data).length : 0,
      error: lastError,
      conflictCopies: lastResult ? lastResult.conflictCopies : 0,
    };
  }

  const announce = (extra = {}) => onState({ ...status(), ...extra });

  async function remoteKeys() {
    try {
      return await client.request("GET", "/v1/vault/keys");
    } catch (error) {
      if (error.status === 404) return null;
      throw error;
    }
  }

  // What the screens need to choose between "put my vault on the account"
  // and "bring the account's vault here".
  async function remote() {
    const keys = await remoteKeys();
    const data = vault.data();
    return { hasVault: Boolean(keys), sameVault: Boolean(keys && data && sameVault(keys, data)) };
  }

  function requireUnlockedVault() {
    if (!vault.data()) throw new SyncError("no_vault", "Create your vault first.");
    if (!vault.unlocked()) throw new SyncError("locked", "Unlock the vault to sync.");
  }

  async function link() {
    const account = client.account();
    if (!account) throw new SyncError("signed_out", "Sign in to sync.");
    requireUnlockedVault();

    let keys = await remoteKeys();
    if (!keys) {
      try {
        keys = await client.request("PUT", "/v1/vault/keys", headerOf(vault.data()));
        // A vault that is new to this account: everything has to go up,
        // including items that an earlier account already had.
        vault.write((data) => ({
          ...data,
          items: data.items.map((i) => ({ ...i, dirty: true })),
          sync: { userId: account.id, cursor: 0, lastSyncAt: null, keysUpdatedAt: keys.updatedAt },
        }));
        return syncNow();
      } catch (error) {
        if (error.code !== "vault_exists") throw error;
        keys = await remoteKeys(); // another computer got there first
      }
    }

    if (!keys || !sameVault(keys, vault.data())) {
      throw new SyncError(
        "different_vault",
        "This account already has a vault from another computer. Enter that vault's passphrase to bring the two together."
      );
    }
    vault.write((data) =>
      data.sync && data.sync.userId === account.id ? data : { ...data, sync: { ...data.sync, userId: account.id, cursor: 0 } }
    );
    return syncNow();
  }

  async function join(passphrase) {
    const account = client.account();
    if (!account) throw new SyncError("signed_out", "Sign in to sync.");
    const keys = await remoteKeys();
    if (!keys) throw new SyncError("no_remote_vault", "This account doesn't have a vault yet.");

    // Already the same vault (signed out and back in): nothing to bring over.
    if (vault.data() && sameVault(keys, vault.data())) return { ...(await link()), carried: 0 };

    let vaultKey;
    try {
      vaultKey = await vaultCrypto.unlockVault(keys, String(passphrase || ""));
    } catch (error) {
      if (!(error instanceof vaultCrypto.WrongSecretError)) throw error;
      throw new SyncError("wrong", "That isn't the passphrase of the vault on your account.");
    }
    let carried;
    try {
      ({ carried } = vault.adopt(headerOf(keys), vaultKey, {
        userId: account.id,
        cursor: 0,
        lastSyncAt: null,
        keysUpdatedAt: keys.updatedAt,
      }));
    } finally {
      vaultKey.fill(0);
    }
    const result = await syncNow();
    return { ...result, carried };
  }

  // The wrapped vault key: upload ours after a passphrase change here,
  // or take the account's after a passphrase change somewhere else.
  async function syncKeys() {
    const keys = await remoteKeys();
    if (!keys) throw new SyncError("no_remote_vault", "The vault is no longer on your account. Sign out and back in to set sync up again.");
    const data = vault.data();
    if (!sameVault(keys, data)) {
      throw new SyncError("different_vault", "The vault on your account is a different one from the vault on this computer.");
    }

    if (data.sync.keysDirty) {
      const saved = await client.request("PUT", "/v1/vault/keys", { ...headerOf(data), ifUpdatedAt: keys.updatedAt });
      vault.write((d) =>
        // Only if the passphrase wasn't changed again while this was in flight.
        sameBlob(d.wrappedKey, data.wrappedKey)
          ? { ...d, sync: { ...d.sync, keysDirty: false, keysUpdatedAt: saved.updatedAt } }
          : d
      );
      return false;
    }
    if (sameBlob(keys.wrappedKey, data.wrappedKey)) return false;
    vault.write((d) => ({ ...d, kdf: keys.kdf, wrappedKey: keys.wrappedKey, sync: { ...d.sync, keysUpdatedAt: keys.updatedAt } }));
    return true; // the passphrase was changed on another computer
  }

  async function runSync() {
    if (!client.account()) throw new SyncError("signed_out", "Sign in to sync.");
    requireUnlockedVault();
    if (!linked()) throw new SyncError("not_linked", "Turn on sync for this vault first.");

    const passphraseChanged = await syncKeys();
    let conflictCopies = 0;
    let pulled = 0;

    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      const pending = items.pendingPush(vault.data());
      for (let i = 0; i < pending.length; i += PUSH_CHUNK) {
        const pushed = await client.request("POST", "/v1/sync/push", { items: pending.slice(i, i + PUSH_CHUNK) });
        vault.write((data) => items.markPushed(data, pushed.accepted));
      }

      let more = true;
      while (more) {
        const page = await client.request("GET", `/v1/sync/pull?since=${vault.data().sync.cursor || 0}`);
        vault.write((data, key) => {
          const merged = items.applyRemote(data, key, page.items, now());
          conflictCopies += merged.conflicts;
          return { ...merged.vault, sync: { ...data.sync, cursor: page.cursor } };
        });
        pulled += page.items.length;
        more = page.more;
      }
      if (!items.pendingPush(vault.data()).length) break;
    }

    vault.write((data) => ({ ...data, sync: { ...data.sync, lastSyncAt: now() } }));
    return { conflictCopies, pulled, passphraseChanged };
  }

  /*
   * One sync at a time. A call that arrives while one is running waits
   * for it and then runs once more, so an edit made mid-sync still goes up.
   */
  function syncNow() {
    if (running) {
      queued = true;
      return running;
    }
    running = (async () => {
      announce();
      try {
        let result = await runSync();
        while (queued) {
          queued = false;
          const again = await runSync();
          result = {
            conflictCopies: result.conflictCopies + again.conflictCopies,
            pulled: result.pulled + again.pulled,
            passphraseChanged: result.passphraseChanged || again.passphraseChanged,
          };
        }
        lastError = null;
        lastResult = result;
        return result;
      } catch (error) {
        queued = false;
        lastError = { code: error.code || "error", message: error.code ? error.message : "Sync failed. It will try again." };
        throw error;
      } finally {
        running = null;
        announce({ finished: true });
      }
    })();
    return running;
  }

  // Background sync: only when there is something to sync with, and never
  // louder than a status line. The error is kept for status().
  function syncQuietly() {
    if (!linked() || !vault.unlocked()) return Promise.resolve(null);
    return syncNow().catch(() => null);
  }

  function clearError() {
    lastError = null;
    lastResult = null;
  }

  return { status, remote, link, join, syncNow, syncQuietly, clearError };
}

module.exports = { createVaultSync, sameVault };
