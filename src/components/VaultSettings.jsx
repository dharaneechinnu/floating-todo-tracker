import { useCallback, useEffect, useState } from "react";

/*
 * The vault's settings: change passphrase, backup file, restore, and the
 * account that syncs the vault between computers. Like VaultPanel, this
 * only shows what the main process returns. Passwords and passphrases
 * typed here are sent to the main process once and never kept in state
 * after the call returns.
 */

const MIN_PASSPHRASE = 10;
const vaultApi = () => window.fx.vault;
const syncApi = () => window.fx.sync;

export function strengthOf(passphrase) {
  const n = passphrase.trim().length;
  if (n === 0) return { level: 0, label: "" };
  if (n < MIN_PASSPHRASE) return { level: 1, label: `Too short: ${MIN_PASSPHRASE - n} more characters` };
  if (n < 16) return { level: 2, label: "Okay. Longer is stronger." };
  return { level: 3, label: "Strong" };
}

function ago(ms) {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// One line that says where sync stands, used in the list footer, the
// settings row and the account screen.
export function syncSummary(sync) {
  if (sync && !sync.account && sync.needsSignIn) return { tone: "warn", text: "Sync paused · sign in again" };
  if (!sync || !sync.account) return { tone: "off", text: "Only on this computer" };
  if (!sync.linked) return { tone: "warn", text: "Signed in · sync is off for this vault" };
  if (sync.syncing) return { tone: "busy", text: "Syncing…" };
  if (sync.error) {
    const waiting = sync.pending ? ` · ${sync.pending} waiting` : "";
    return { tone: "warn", text: `${sync.error.code === "offline" ? "Offline" : "Sync paused"}${waiting}` };
  }
  if (sync.pending) return { tone: "busy", text: `${sync.pending} ${sync.pending === 1 ? "change" : "changes"} waiting to sync` };
  return { tone: "ok", text: sync.lastSyncAt ? `Synced ${ago(sync.lastSyncAt)}` : "Sync is on" };
}

function Bar({ title, onBack, backLabel = "Back" }) {
  return (
    <div className="vault-bar">
      <button type="button" className="vault-icon-btn" onClick={onBack} aria-label={backLabel}>‹</button>
      <h3 className="vault-title grow">{title}</h3>
    </div>
  );
}

/* ---------- settings ---------- */

export function SettingsScreen({ syncOn, sync, onBack, onOpen, onRestored }) {
  const [notice, setNotice] = useState(null); // { tone: "ok" | "bad", text }
  const [busy, setBusy] = useState("");
  const summary = syncSummary(sync);

  const backUp = async () => {
    setBusy("backup");
    const res = await vaultApi().exportBackup();
    setBusy("");
    if (!res.ok) return setNotice({ tone: "bad", text: res.message });
    if (!res.value.saved) return setNotice(null);
    setNotice({
      tone: "ok",
      text: `${res.value.count} ${res.value.count === 1 ? "item" : "items"} saved to ${res.value.name}. It opens with your passphrase or recovery code.`,
    });
  };

  const restore = async () => {
    setBusy("restore");
    const res = await vaultApi().pickBackup();
    setBusy("");
    if (!res.ok) return setNotice({ tone: "bad", text: res.message });
    if (!res.value.picked) return setNotice(null);
    if (res.value.needsSecret) return onOpen("restore", res.value);
    const done = await vaultApi().importBackup();
    if (!done.ok) return setNotice({ tone: "bad", text: done.message });
    onRestored();
    setNotice({ tone: "ok", text: restoreMessage(done.value) });
  };

  return (
    <div className="vault-view">
      <Bar title="Vault settings" onBack={onBack} backLabel="Back to the vault" />
      <div className="vault-list">
        {syncOn && (
          <button type="button" className="vault-row" onClick={() => onOpen("account")}>
            <span className="vault-row-text">
              <b>Account and sync</b>
              <small>
                {sync && sync.account
                  ? `${sync.account.email} · ${summary.text}`
                  : sync && sync.needsSignIn ? summary.text : "Use this vault on your other computers"}
              </small>
            </span>
            <span className={`vault-dot ${summary.tone}`} aria-hidden="true" />
            <span className="vault-chevron" aria-hidden="true">›</span>
          </button>
        )}
        <button type="button" className="vault-row" onClick={() => onOpen("passphrase")}>
          <span className="vault-row-text">
            <b>Change passphrase</b>
            <small>Your notes and recovery code stay the same</small>
          </span>
          <span className="vault-chevron" aria-hidden="true">›</span>
        </button>
        <button type="button" className="vault-row" onClick={backUp} disabled={Boolean(busy)}>
          <span className="vault-row-text">
            <b>{busy === "backup" ? "Saving…" : "Back up to a file"}</b>
            <small>An encrypted copy you can keep anywhere</small>
          </span>
        </button>
        <button type="button" className="vault-row" onClick={restore} disabled={Boolean(busy)}>
          <span className="vault-row-text">
            <b>{busy === "restore" ? "Opening…" : "Restore from a backup"}</b>
            <small>Brings back what&apos;s missing. Replaces nothing.</small>
          </span>
        </button>
      </div>
      {notice && <p className={notice.tone === "ok" ? "vault-ok" : "vault-error"} role="status">{notice.text}</p>}
    </div>
  );
}

function restoreMessage({ restored, skipped }) {
  if (!restored && !skipped) return "That backup is empty.";
  if (!restored) return "Nothing to restore: everything in that backup is already in your vault.";
  const back = `${restored} ${restored === 1 ? "item" : "items"} restored.`;
  return skipped ? `${back} ${skipped} already here, left as they are.` : back;
}

/* ---------- change passphrase ---------- */

export function ChangePassphraseScreen({ synced, onBack }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const strength = strengthOf(next);

  const submit = async (e) => {
    e.preventDefault();
    if (next !== again) return setError("The two new passphrases don't match.");
    setBusy(true);
    const res = await vaultApi().changePassphrase(current, next);
    setBusy(false);
    if (!res.ok) return setError(res.message);
    setCurrent("");
    setNext("");
    setAgain("");
    setDone(true);
  };

  if (done) {
    return (
      <div className="vault-view">
        <Bar title="Passphrase changed" onBack={onBack} />
        <p className="vault-ok" role="status">
          Use your new passphrase from the next unlock. Your recovery code hasn&apos;t changed.
        </p>
        {synced && (
          <p className="vault-note">
            Your other computers switch to the new passphrase the next time they sync. Until then they still open with the old one.
          </p>
        )}
        <button type="button" className="vault-primary" onClick={onBack}>Done</button>
      </div>
    );
  }

  return (
    <form className="vault-view" onSubmit={submit}>
      <Bar title="Change passphrase" onBack={onBack} />
      <input
        id="vault-current-pass"
        className="vault-input"
        type="password"
        placeholder="Current passphrase"
        aria-label="Current passphrase"
        value={current}
        onChange={(e) => { setCurrent(e.target.value); setError(""); }}
        autoFocus
      />
      <input
        id="vault-next-pass"
        className="vault-input"
        type="password"
        placeholder="New passphrase"
        aria-label="New passphrase"
        value={next}
        onChange={(e) => { setNext(e.target.value); setError(""); }}
      />
      <div className="vault-strength" data-level={strength.level} aria-hidden="true"><i /></div>
      {strength.label && <p className="vault-note">{strength.label}</p>}
      <input
        id="vault-next-pass-again"
        className="vault-input"
        type="password"
        placeholder="Type the new one again"
        aria-label="Repeat new passphrase"
        value={again}
        onChange={(e) => { setAgain(e.target.value); setError(""); }}
      />
      <p className="vault-error" role="alert">{error}</p>
      <button className="vault-primary" type="submit" disabled={busy || !current || strength.level < 2 || !again}>
        {busy ? "Changing…" : "Change passphrase"}
      </button>
    </form>
  );
}

/* ---------- restore from another vault's backup ---------- */

export function RestoreScreen({ file, onBack, onRestored }) {
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const res = await vaultApi().importBackup(secret);
    setBusy(false);
    if (!res.ok) return setError(res.message);
    setSecret("");
    setResult(res.value);
    onRestored();
  };

  if (result) {
    return (
      <div className="vault-view">
        <Bar title="Backup restored" onBack={onBack} />
        <p className="vault-ok" role="status">{restoreMessage(result)}</p>
        <button type="button" className="vault-primary" onClick={onBack}>Done</button>
      </div>
    );
  }

  const made = file.createdAt ? new Date(file.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "";
  return (
    <form className="vault-view" onSubmit={submit}>
      <Bar title="Restore a backup" onBack={onBack} />
      <div className="vault-file">
        <b>{file.name}</b>
        <small>{file.count} {file.count === 1 ? "item" : "items"}{made ? ` · made ${made}` : ""}</small>
      </div>
      <p className="vault-note">
        This backup comes from a different vault. Enter the passphrase that vault had, or its recovery code. Its notes are added to your vault; nothing is replaced.
      </p>
      <input
        id="vault-backup-secret"
        className="vault-input"
        type="password"
        placeholder="Backup passphrase or recovery code"
        aria-label="Backup passphrase or recovery code"
        value={secret}
        onChange={(e) => { setSecret(e.target.value); setError(""); }}
        autoFocus
      />
      <p className="vault-error" role="alert">{error}</p>
      <button className="vault-primary" type="submit" disabled={busy || !secret}>
        {busy ? "Restoring…" : "Restore"}
      </button>
    </form>
  );
}

/* ---------- account and sync ---------- */

function SignInForm({ defaultServer, onSignedIn }) {
  const [create, setCreate] = useState(false);
  const [server, setServer] = useState(defaultServer || "");
  const [editServer, setEditServer] = useState(!defaultServer);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (create && password.length < 10) return setError("Use at least 10 characters for the account password.");
    setBusy(true);
    const res = await syncApi().signIn({ server, email, password, create });
    setBusy(false);
    if (!res.ok) return setError(res.message);
    setPassword("");
    onSignedIn(res.value);
  };

  return (
    <form className="vault-form" onSubmit={submit}>
      <div className="vault-seg" role="tablist" aria-label="Account">
        <button type="button" role="tab" aria-selected={!create} className={!create ? "on" : ""} onClick={() => { setCreate(false); setError(""); }}>Sign in</button>
        <button type="button" role="tab" aria-selected={create} className={create ? "on" : ""} onClick={() => { setCreate(true); setError(""); }}>Create account</button>
      </div>
      <p className="vault-note">
        {create
          ? "An account only carries your vault between computers. It is separate from your vault passphrase, which is never sent anywhere."
          : "Sign in to use the same vault on this computer."}
      </p>
      {editServer ? (
        <input
          id="sync-server"
          className="vault-input vault-mono"
          placeholder="Sync server, e.g. sync.example.com"
          aria-label="Sync server address"
          value={server}
          onChange={(e) => { setServer(e.target.value); setError(""); }}
          autoFocus={!server}
        />
      ) : (
        <p className="vault-note">
          Server: <span className="vault-mono">{server.replace(/^https?:\/\//, "")}</span> ·{" "}
          <button type="button" className="vault-link" onClick={() => setEditServer(true)}>change</button>
        </p>
      )}
      <input
        id="sync-email"
        className="vault-input"
        type="email"
        placeholder="Email"
        aria-label="Email"
        value={email}
        onChange={(e) => { setEmail(e.target.value); setError(""); }}
        autoComplete="off"
      />
      <input
        id="sync-password"
        className="vault-input"
        type="password"
        placeholder={create ? "Account password (10+ characters)" : "Account password"}
        aria-label="Account password"
        value={password}
        onChange={(e) => { setPassword(e.target.value); setError(""); }}
        autoComplete="new-password"
      />
      <p className="vault-error" role="alert">{error}</p>
      <button className="vault-primary" type="submit" disabled={busy || !server || !email || !password}>
        {busy ? "One moment…" : create ? "Create account" : "Sign in"}
      </button>
    </form>
  );
}

/*
 * Signed in, but this vault isn't syncing yet. What happens next depends
 * on what the account already holds, so ask the server first.
 */
function ConnectVault({ hasLocalVault, onSync, onVaultChanged }) {
  const [remote, setRemote] = useState(null); // null | { hasVault, sameVault } | { error }
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const check = useCallback(async () => {
    setRemote(null);
    const res = await syncApi().remote();
    setRemote(res.ok ? res.value : { error: res.message });
  }, []);
  useEffect(() => { check(); }, [check]);

  const run = async (call) => {
    setBusy(true);
    setError("");
    const res = await call();
    setBusy(false);
    setPassphrase("");
    if (!res.ok) {
      // Linking can succeed and the first sync still fail (offline): the
      // status says which, so refresh it either way.
      const status = await syncApi().status();
      if (status.ok) onSync(status.value);
      return setError(res.message);
    }
    onSync(res.value.status);
    onVaultChanged(res.value.result);
  };

  if (!remote) return <p className="vault-note">Checking your account…</p>;
  if (remote.error) {
    return (
      <>
        <p className="vault-error" role="alert">{remote.error}</p>
        <button type="button" className="vault-ghost" onClick={check}>Try again</button>
      </>
    );
  }

  if (!remote.hasVault && !hasLocalVault) {
    return <p className="vault-note">This account has no vault yet. Go back, create your vault, then turn on sync in the vault&apos;s settings.</p>;
  }

  if (!remote.hasVault || remote.sameVault) {
    return (
      <>
        <p className="vault-note">
          Turn on sync to keep this vault on your account. Everything is encrypted on this computer first: the server stores it but can&apos;t read it.
        </p>
        <p className="vault-error" role="alert">{error}</p>
        <button type="button" className="vault-primary" disabled={busy} onClick={() => run(() => syncApi().link())}>
          {busy ? "Turning on…" : "Turn on sync"}
        </button>
      </>
    );
  }

  return (
    <form className="vault-form" onSubmit={(e) => { e.preventDefault(); run(() => syncApi().join(passphrase)); }}>
      <p className="vault-note">
        {hasLocalVault
          ? "Your account already has a vault from another computer. Enter that vault's passphrase to bring the two together: the notes on this computer are added to it, and this computer then opens with that passphrase."
          : "Your account has a vault. Enter its vault passphrase to open it on this computer."}
      </p>
      <input
        id="sync-join-pass"
        className="vault-input"
        type="password"
        placeholder="Vault passphrase"
        aria-label="Vault passphrase of the account's vault"
        value={passphrase}
        onChange={(e) => { setPassphrase(e.target.value); setError(""); }}
        autoFocus
      />
      <p className="vault-error" role="alert">{error}</p>
      <button className="vault-primary" type="submit" disabled={busy || !passphrase}>
        {busy ? "Opening…" : hasLocalVault ? "Bring the vaults together" : "Open my vault here"}
      </button>
    </form>
  );
}

function SyncedView({ sync, onSync, onVaultChanged }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const summary = syncSummary(sync);

  const syncNow = async () => {
    setBusy(true);
    setNote("");
    const res = await syncApi().now();
    setBusy(false);
    if (res.ok) {
      onSync(res.value.status);
      onVaultChanged(res.value.result);
      if (res.value.result.passphraseChanged) setNote("The passphrase was changed on another computer. Use the new one from the next unlock.");
    } else {
      const status = await syncApi().status();
      if (status.ok) onSync(status.value);
    }
  };

  return (
    <>
      <div className="vault-sync-card">
        <span className={`vault-dot ${summary.tone}`} aria-hidden="true" />
        <span className="vault-row-text">
          <b>{summary.text}</b>
          <small>{sync.error ? sync.error.message : "Encrypted before it leaves this computer"}</small>
        </span>
      </div>
      {sync.conflictCopies > 0 && (
        <p className="vault-banner inline">
          {sync.conflictCopies === 1 ? "A note was" : `${sync.conflictCopies} notes were`} edited on two computers. Both versions were kept; look for “(conflict copy)”.
        </p>
      )}
      {note && <p className="vault-banner inline">{note}</p>}
      <button type="button" className="vault-primary" disabled={busy || sync.syncing} onClick={syncNow}>
        {busy || sync.syncing ? "Syncing…" : "Sync now"}
      </button>
    </>
  );
}

function AccountFooter({ onSync, linked }) {
  const [confirm, setConfirm] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    const res = await syncApi().signOut();
    if (res.ok) onSync(res.value);
  };

  const remove = async (e) => {
    e.preventDefault();
    setBusy(true);
    const res = await syncApi().deleteAccount(password);
    setBusy(false);
    setPassword("");
    if (!res.ok) return setError(res.message);
    onSync(res.value);
  };

  if (confirm) {
    return (
      <form className="vault-confirm" role="alertdialog" aria-label="Delete account" onSubmit={remove}>
        <p>
          Delete your account and the copy of your vault on the server? Your vault stays on this computer
          {linked ? ", but your other computers stop syncing." : "."} This can&apos;t be undone.
        </p>
        <input
          id="sync-delete-pass"
          className="vault-input"
          type="password"
          placeholder="Account password"
          aria-label="Account password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(""); }}
          autoFocus
        />
        {error && <p className="vault-error" role="alert">{error}</p>}
        <div className="vault-confirm-actions">
          <button type="button" className="vault-ghost" onClick={() => { setConfirm(false); setPassword(""); setError(""); }}>Keep it</button>
          <button type="submit" className="vault-danger" disabled={busy || !password}>{busy ? "Deleting…" : "Delete account"}</button>
        </div>
      </form>
    );
  }

  return (
    <p className="vault-note vault-foot">
      <button type="button" className="vault-link" onClick={signOut}>Sign out</button> ·{" "}
      <button type="button" className="vault-link" onClick={() => setConfirm(true)}>Delete account…</button>
    </p>
  );
}

export function AccountScreen({ sync, hasLocalVault, onBack, onSync, onVaultChanged }) {
  let body;
  if (!sync) {
    body = <p className="vault-note">Loading…</p>;
  } else if (sync.unavailable) {
    body = <p className="vault-error" role="alert">{sync.unavailable}</p>;
  } else if (!sync.account) {
    body = <SignInForm defaultServer={sync.serverUrl} onSignedIn={onSync} />;
  } else {
    body = (
      <>
        <p className="vault-account">
          <span className="vault-avatar" aria-hidden="true">{sync.account.email[0].toUpperCase()}</span>
          <span className="vault-row-text">
            <b>{sync.account.email}</b>
            <small>{sync.serverUrl.replace(/^https?:\/\//, "")}</small>
          </span>
        </p>
        {sync.linked ? (
          <SyncedView sync={sync} onSync={onSync} onVaultChanged={onVaultChanged} />
        ) : (
          <ConnectVault key={sync.account.id} hasLocalVault={hasLocalVault} onSync={onSync} onVaultChanged={onVaultChanged} />
        )}
        <AccountFooter onSync={onSync} linked={sync.linked} />
      </>
    );
  }

  return (
    <div className="vault-view">
      <Bar title="Account and sync" onBack={onBack} />
      {body}
    </div>
  );
}
