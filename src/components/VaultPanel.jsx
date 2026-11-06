import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/*
 * The Secret Vault screens. All vault logic lives in the main process
 * (electron/vault/session.js); this file only shows what it returns.
 * Passwords are fetched for the one open note and dropped from state the
 * moment the vault locks.
 */

const SECTION_COLORS = ["#5b8cff", "#2ea45f", "#ff7a1a", "#c25bd6", "#e0a020", "#ff5a5a"];
const MIN_PASSPHRASE = 10;
const vaultApi = () => window.fx.vault;

function strengthOf(passphrase) {
  const n = passphrase.trim().length;
  if (n === 0) return { level: 0, label: "" };
  if (n < MIN_PASSPHRASE) return { level: 1, label: `Too short: ${MIN_PASSPHRASE - n} more characters` };
  if (n < 16) return { level: 2, label: "Okay. Longer is stronger." };
  return { level: 3, label: "Strong" };
}

function relativeTime(ms) {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function LockIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function Countdown({ until, onDone }) {
  const [left, setLeft] = useState(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
  useEffect(() => {
    const t = setInterval(() => {
      const s = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) {
        clearInterval(t);
        onDone();
      }
    }, 250);
    return () => clearInterval(t);
  }, [until, onDone]);
  return <span>{left}s</span>;
}

/* ---------- setup, recovery code, lock, recover ---------- */

function SetupScreen({ onCreated }) {
  const [pass, setPass] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const strength = strengthOf(pass);

  const submit = async (e) => {
    e.preventDefault();
    if (pass !== again) return setError("The two passphrases don't match.");
    setBusy(true);
    const res = await vaultApi().create(pass);
    setBusy(false);
    if (!res.ok) return setError(res.message);
    onCreated(res.value.recoveryCode);
  };

  return (
    <form className="vault-view" onSubmit={submit}>
      <h3 className="vault-title">Create your vault</h3>
      <p className="vault-note">
        Pick a passphrase you don&apos;t use anywhere else. It never leaves this computer, and nobody can reset it for you.
      </p>
      <input
        id="vault-new-pass"
        className="vault-input"
        type="password"
        placeholder="Vault passphrase"
        aria-label="Vault passphrase"
        value={pass}
        onChange={(e) => { setPass(e.target.value); setError(""); }}
        autoFocus
      />
      <div className="vault-strength" data-level={strength.level} aria-hidden="true"><i /></div>
      {strength.label && <p className="vault-note">{strength.label}</p>}
      <input
        id="vault-new-pass-again"
        className="vault-input"
        type="password"
        placeholder="Type it again"
        aria-label="Repeat passphrase"
        value={again}
        onChange={(e) => { setAgain(e.target.value); setError(""); }}
      />
      <p className="vault-error" role="alert">{error}</p>
      <button className="vault-primary" type="submit" disabled={busy || strength.level < 2 || !again}>
        {busy ? "Creating…" : "Create vault"}
      </button>
    </form>
  );
}

function RecoveryCodeScreen({ code, onDone }) {
  const [saved, setSaved] = useState(false);
  return (
    <div className="vault-view">
      <h3 className="vault-title">Save your recovery code</h3>
      <p className="vault-note">
        If you forget your passphrase, this code is the only way back in. It&apos;s shown once. Write it down and keep it somewhere safe.
      </p>
      <div className="vault-code" aria-label="Recovery code">
        {code.split("-").map((group, i) => <span key={i}>{group}</span>)}
      </div>
      <label className="vault-check">
        <input id="vault-saved-code" type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        I&apos;ve written it down
      </label>
      <button className="vault-primary" type="button" disabled={!saved} onClick={onDone}>
        Open my vault
      </button>
    </div>
  );
}

function LockedScreen({ status, onUnlocked, onForgot, onRefresh }) {
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [waitUntil, setWaitUntil] = useState(status.waitMs ? Date.now() + status.waitMs : 0);
  const clearWait = useCallback(() => { setWaitUntil(0); setError(""); onRefresh(); }, [onRefresh]);

  const submit = async (e) => {
    e.preventDefault();
    if (!pass) return setError("Enter your passphrase to unlock.");
    setBusy(true);
    const res = await vaultApi().unlock(pass);
    setBusy(false);
    if (res.ok) return onUnlocked();
    setPass("");
    setError(res.message);
    if (res.waitMs) setWaitUntil(Date.now() + res.waitMs);
  };

  return (
    <form className="vault-lock" onSubmit={submit}>
      <div className="vault-lock-icon"><LockIcon /></div>
      <h3 className="vault-title">Vault is locked</h3>
      <p className="vault-note">Enter your vault passphrase. It never leaves this computer.</p>
      <input
        id="vault-unlock-pass"
        className="vault-input"
        type="password"
        placeholder="Vault passphrase"
        aria-label="Vault passphrase"
        value={pass}
        onChange={(e) => { setPass(e.target.value); if (!waitUntil) setError(""); }}
        disabled={Boolean(waitUntil)}
        autoFocus
      />
      <p className="vault-error" role="alert">
        {error}
        {waitUntil ? <> Try again in <Countdown until={waitUntil} onDone={clearWait} />.</> : null}
      </p>
      <button className="vault-primary" type="submit" disabled={busy || Boolean(waitUntil)}>
        {busy ? "Unlocking…" : "Unlock"}
      </button>
      <p className="vault-note">
        Locks after {status.autoLockMinutes || 5} idle minutes ·{" "}
        <button type="button" className="vault-link" onClick={onForgot}>Forgot passphrase?</button>
      </p>
    </form>
  );
}

function RecoverScreen({ onRecovered, onBack }) {
  const [code, setCode] = useState("");
  const [pass, setPass] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const strength = strengthOf(pass);

  const submit = async (e) => {
    e.preventDefault();
    if (pass !== again) return setError("The two passphrases don't match.");
    setBusy(true);
    const res = await vaultApi().recover(code, pass);
    setBusy(false);
    if (!res.ok) return setError(res.message);
    onRecovered();
  };

  return (
    <form className="vault-view" onSubmit={submit}>
      <div className="vault-bar">
        <button type="button" className="vault-icon-btn" onClick={onBack} aria-label="Back">‹</button>
        <h3 className="vault-title">Use your recovery code</h3>
      </div>
      <p className="vault-note">Enter the code you saved when you created the vault, then choose a new passphrase.</p>
      <input
        id="vault-recovery-code"
        className="vault-input vault-mono"
        placeholder="ABCD-EFGH-…"
        aria-label="Recovery code"
        value={code}
        onChange={(e) => { setCode(e.target.value); setError(""); }}
        autoFocus
      />
      <input
        id="vault-recover-pass"
        className="vault-input"
        type="password"
        placeholder="New passphrase"
        aria-label="New passphrase"
        value={pass}
        onChange={(e) => { setPass(e.target.value); setError(""); }}
      />
      <div className="vault-strength" data-level={strength.level} aria-hidden="true"><i /></div>
      <input
        id="vault-recover-pass-again"
        className="vault-input"
        type="password"
        placeholder="Type it again"
        aria-label="Repeat new passphrase"
        value={again}
        onChange={(e) => { setAgain(e.target.value); setError(""); }}
      />
      <p className="vault-error" role="alert">{error}</p>
      <button className="vault-primary" type="submit" disabled={busy || !code || strength.level < 2 || !again}>
        {busy ? "Checking…" : "Set new passphrase"}
      </button>
    </form>
  );
}

/* ---------- sections and notes ---------- */

function InlineName({ placeholder, initial = "", onSubmit, onCancel, id }) {
  const [value, setValue] = useState(initial);
  return (
    <form
      className="vault-inline"
      onSubmit={(e) => { e.preventDefault(); if (value.trim()) onSubmit(value.trim()); }}
    >
      <input
        id={id}
        className="vault-input"
        placeholder={placeholder}
        aria-label={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
        autoFocus
      />
      <button type="submit" className="vault-icon-btn" disabled={!value.trim()}>Add</button>
    </form>
  );
}

function SectionsScreen({ entries, onOpenSection, onOpenNote, onAddSection }) {
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const sections = entries.filter((e) => e.kind === "section");
  const q = query.trim().toLowerCase();
  const matchingNotes = q ? entries.filter((e) => e.kind !== "section" && e.title.toLowerCase().includes(q)) : [];
  const shownSections = q ? sections.filter((s) => s.title.toLowerCase().includes(q)) : sections;
  const sectionById = useMemo(() => new Map(sections.map((s) => [s.id, s])), [sections]);

  return (
    <div className="vault-view">
      <input
        id="vault-search"
        className="vault-input"
        placeholder="Search sections and notes"
        aria-label="Search vault"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {sections.length === 0 && !adding && (
        <p className="vault-empty">No sections yet. Make one for each part of your life, like Work, Personal or Banking.</p>
      )}
      <div className="vault-list">
        {shownSections.map((s) => (
          <button key={s.id} type="button" className="vault-row" onClick={() => onOpenSection(s.id)}>
            <span className="vault-swatch" style={{ background: s.color || SECTION_COLORS[0] }}>{(s.title[0] || "?").toUpperCase()}</span>
            <span className="vault-row-text">
              <b>{s.title}</b>
              <small>{s.noteCount ? `${s.noteCount} ${s.noteCount === 1 ? "note" : "notes"}` : "Empty"}</small>
            </span>
            <span className="vault-chevron" aria-hidden="true">›</span>
          </button>
        ))}
        {matchingNotes.map((n) => (
          <button key={n.id} type="button" className="vault-row" onClick={() => onOpenNote(n.parentId, n.id)}>
            <span className="vault-row-text">
              <b>{n.title || "Untitled"}</b>
              <small>in {sectionById.get(n.parentId)?.title || "a section"}</small>
            </span>
            <span className={`vault-chip${n.kind === "login" ? " key" : ""}`}>{n.kind === "login" ? "🔑" : "Note"}</span>
          </button>
        ))}
        {q && shownSections.length === 0 && matchingNotes.length === 0 && (
          <p className="vault-empty">Nothing matches “{query}”.</p>
        )}
      </div>
      {adding ? (
        <InlineName
          id="vault-new-section"
          placeholder="Section name"
          onCancel={() => setAdding(false)}
          onSubmit={async (title) => {
            await onAddSection(title, SECTION_COLORS[sections.length % SECTION_COLORS.length]);
            setAdding(false);
          }}
        />
      ) : (
        <button type="button" className="vault-ghost" onClick={() => setAdding(true)}>+ New section</button>
      )}
    </div>
  );
}

function SectionScreen({ section, notes, onBack, onOpenNote, onAddNote, onRename, onDelete }) {
  const [menu, setMenu] = useState(null); // null | "rename" | "confirm-delete"
  if (!section) return null;

  return (
    <div className="vault-view">
      <div className="vault-bar">
        <button type="button" className="vault-icon-btn" onClick={onBack} aria-label="Back to sections">‹</button>
        <span className="vault-swatch small" style={{ background: section.color || SECTION_COLORS[0] }}>
          {(section.title[0] || "?").toUpperCase()}
        </span>
        <h3 className="vault-title grow">{section.title}</h3>
        <button type="button" className="vault-icon-btn" onClick={() => setMenu(menu ? null : "rename")} aria-label="Rename section">✎</button>
        <button type="button" className="vault-icon-btn danger" onClick={() => setMenu("confirm-delete")} aria-label="Delete section">🗑</button>
      </div>

      {menu === "rename" && (
        <InlineName
          id="vault-rename-section"
          placeholder="Section name"
          initial={section.title}
          onCancel={() => setMenu(null)}
          onSubmit={async (title) => { await onRename(title); setMenu(null); }}
        />
      )}
      {menu === "confirm-delete" && (
        <div className="vault-confirm" role="alertdialog" aria-label="Delete section">
          <p>Delete “{section.title}” and its {notes.length} {notes.length === 1 ? "note" : "notes"}? This can&apos;t be undone.</p>
          <div className="vault-confirm-actions">
            <button type="button" className="vault-ghost" onClick={() => setMenu(null)}>Keep it</button>
            <button type="button" className="vault-danger" onClick={onDelete}>Delete</button>
          </div>
        </div>
      )}

      {notes.length ? (
        <div className="vault-list">
          {notes.map((n) => (
            <button key={n.id} type="button" className="vault-row" onClick={() => onOpenNote(n.id)}>
              <span className="vault-row-text">
                <b>{n.title || "Untitled"}</b>
                <small>{n.kind === "login" ? n.username || "Password only" : `Edited ${relativeTime(n.updatedAt)}`}</small>
              </span>
              <span className={`vault-chip${n.kind === "login" ? " key" : ""}`}>{n.kind === "login" ? "🔑" : "Note"}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="vault-empty">No notes here yet. Add a secure note for free text, or a login for a username and password.</p>
      )}
      <div className="vault-two">
        <button type="button" className="vault-ghost" onClick={() => onAddNote("note")}>+ Secure note</button>
        <button type="button" className="vault-ghost" onClick={() => onAddNote("login")}>+ Login</button>
      </div>
    </div>
  );
}

const SAVE_DELAY_MS = 500;

function NoteScreen({ noteId, onBack, onDeleted, onChanged, onCopied }) {
  const [note, setNote] = useState(null);
  const [draft, setDraft] = useState({});
  const [reveal, setReveal] = useState(false);
  const [saveState, setSaveState] = useState("saved"); // saved | pending | saving | error
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef({});
  const timer = useRef(null);

  useEffect(() => {
    let live = true;
    vaultApi().open(noteId).then((res) => {
      if (!live) return;
      if (!res.ok) return setError(res.message);
      setNote(res.value);
      setDraft(res.value.content);
    });
    return () => { live = false; };
  }, [noteId]);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const changes = pending.current;
    pending.current = {};
    if (!Object.keys(changes).length) return;
    setSaveState("saving");
    const res = await vaultApi().update(noteId, changes);
    if (!res.ok) {
      setSaveState("error");
      setError(res.message);
      return;
    }
    setSaveState(Object.keys(pending.current).length ? "pending" : "saved");
    onChanged();
  }, [noteId, onChanged]);

  // Save whatever is pending when leaving the note.
  useEffect(() => () => { flush(); }, [flush]);

  const edit = (field, value) => {
    setDraft((d) => ({ ...d, [field]: value }));
    pending.current = { ...pending.current, [field]: value };
    setSaveState("pending");
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY_MS);
  };

  const copy = async (field) => {
    await flush();
    const res = await vaultApi().copy(noteId, field);
    if (res.ok) onCopied(field, res.value.clearsInMs);
    else setError(res.message);
  };

  const remove = async () => {
    clearTimeout(timer.current);
    pending.current = {};
    const res = await vaultApi().remove(noteId);
    if (res.ok) onDeleted();
    else setError(res.message);
  };

  if (!note) return <div className="vault-view"><p className="vault-error">{error}</p></div>;
  const isLogin = note.kind === "login";
  const saveLabel = { saved: "Saved · encrypted", pending: "Editing…", saving: "Saving…", error: "Not saved" }[saveState];

  return (
    <div className="vault-view">
      <div className="vault-bar">
        <button type="button" className="vault-icon-btn" onClick={async () => { await flush(); onBack(); }} aria-label="Back to section">‹</button>
        <input
          id="vault-note-title"
          className="vault-title-input"
          value={draft.title || ""}
          placeholder="Untitled"
          aria-label="Title"
          onChange={(e) => edit("title", e.target.value)}
          autoFocus={!draft.title}
        />
        <button type="button" className="vault-icon-btn danger" onClick={() => setConfirmDelete(true)} aria-label="Delete note">🗑</button>
      </div>

      {confirmDelete && (
        <div className="vault-confirm" role="alertdialog" aria-label="Delete note">
          <p>Delete “{draft.title || "Untitled"}”? This can&apos;t be undone.</p>
          <div className="vault-confirm-actions">
            <button type="button" className="vault-ghost" onClick={() => setConfirmDelete(false)}>Keep it</button>
            <button type="button" className="vault-danger" onClick={remove}>Delete</button>
          </div>
        </div>
      )}

      {isLogin && (
        <>
          <label className="vault-field">
            <span>Username</span>
            <span className="vault-field-row">
              <input id="vault-note-username" className="vault-input vault-mono" value={draft.username || ""} onChange={(e) => edit("username", e.target.value)} autoComplete="off" />
              <button type="button" className="vault-icon-btn" onClick={() => copy("username")} disabled={!draft.username}>Copy</button>
            </span>
          </label>
          <label className="vault-field">
            <span>Password</span>
            <span className="vault-field-row">
              <input
                id="vault-note-password"
                className="vault-input vault-mono"
                type={reveal ? "text" : "password"}
                value={draft.password || ""}
                onChange={(e) => edit("password", e.target.value)}
                autoComplete="new-password"
              />
              <button type="button" className="vault-icon-btn" onClick={() => setReveal((r) => !r)} aria-label={reveal ? "Hide password" : "Show password"}>
                {reveal ? "🙈" : "👁"}
              </button>
              <button type="button" className="vault-icon-btn" onClick={() => copy("password")} disabled={!draft.password}>Copy</button>
            </span>
          </label>
          <label className="vault-field">
            <span>Website</span>
            <span className="vault-field-row">
              <input id="vault-note-url" className="vault-input vault-mono" value={draft.url || ""} onChange={(e) => edit("url", e.target.value)} placeholder="example.com" />
            </span>
          </label>
        </>
      )}

      <label className="vault-field grow">
        <span>Notes</span>
        <textarea
          id="vault-note-body"
          className="vault-input vault-textarea"
          value={draft.body || ""}
          onChange={(e) => edit("body", e.target.value)}
          placeholder={isLogin ? "2FA hints, security questions…" : "Write anything. It's encrypted on this computer."}
        />
      </label>
      <p className={`vault-meta${saveState === "error" ? " bad" : ""}`}>
        {saveLabel}
        {error && saveState === "error" ? ` · ${error}` : ""}
      </p>
    </div>
  );
}

/* ---------- the panel ---------- */

export default function VaultPanel({ tabs, onClose }) {
  const [status, setStatus] = useState(null);
  const [screen, setScreen] = useState({ name: "loading" });
  const [entries, setEntries] = useState([]);
  const [recoveryCode, setRecoveryCode] = useState(null);
  const [toast, setToast] = useState(null);
  const [lockNotice, setLockNotice] = useState("");

  const refreshStatus = useCallback(async () => {
    const res = await vaultApi().status();
    if (!res.ok) {
      setStatus({ state: "error", message: res.message });
      return null;
    }
    setStatus(res.value);
    return res.value;
  }, []);

  const refreshList = useCallback(async () => {
    const res = await vaultApi().list();
    if (res.ok) setEntries(res.value);
  }, []);

  const enterVault = useCallback(async () => {
    await refreshStatus();
    await refreshList();
    setLockNotice("");
    setScreen({ name: "sections" });
  }, [refreshStatus, refreshList]);

  useEffect(() => {
    refreshStatus().then((s) => {
      if (s && s.state === "unlocked") enterVault();
      else setScreen({ name: "locked" }); // setup, lock screen or "newer", chosen from status
    });
    // Locked from the main process (idle, sleep, screen lock): drop every
    // decrypted value from memory and go back to the lock screen.
    return vaultApi().onLocked((reason) => {
      setEntries([]);
      setToast(null);
      setRecoveryCode(null);
      setScreen({ name: "locked" });
      setLockNotice(
        { idle: "Locked after 5 idle minutes.", sleep: "Locked when the computer went to sleep.", screen: "Locked with your screen." }[reason] || ""
      );
      refreshStatus();
    });
  }, [refreshStatus, enterVault]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setInterval(() => {
      setToast((current) => {
        if (!current) return null;
        const left = Math.ceil((current.until - Date.now()) / 1000);
        return left <= 0 ? null : { ...current, left };
      });
    }, 500);
    return () => clearInterval(t);
  }, [toast]);

  const lockNow = async () => {
    await vaultApi().lock();
  };

  const sections = entries.filter((e) => e.kind === "section");
  const currentSection = screen.sectionId ? sections.find((s) => s.id === screen.sectionId) : null;
  const sectionNotes = currentSection
    ? entries.filter((e) => e.parentId === currentSection.id).sort((a, b) => b.updatedAt - a.updatedAt)
    : [];

  let body;
  if (!status || screen.name === "loading") {
    body = <div className="vault-view"><p className="vault-note">Opening the vault…</p></div>;
  } else if (status.state === "error") {
    body = <div className="vault-view"><p className="vault-error">{status.message}</p></div>;
  } else if (status.state === "newer") {
    body = (
      <div className="vault-lock">
        <div className="vault-lock-icon"><LockIcon /></div>
        <h3 className="vault-title">Update FocusDock to open this vault</h3>
        <p className="vault-note">It was saved by a newer version. Nothing has been changed.</p>
      </div>
    );
  } else if (recoveryCode) {
    body = <RecoveryCodeScreen code={recoveryCode} onDone={() => { setRecoveryCode(null); enterVault(); }} />;
  } else if (status.state === "none") {
    body = <SetupScreen onCreated={(code) => { setRecoveryCode(code); refreshStatus(); }} />;
  } else if (status.state === "locked" && screen.name === "recover") {
    body = <RecoverScreen onBack={() => setScreen({ name: "locked" })} onRecovered={enterVault} />;
  } else if (status.state === "locked") {
    body = (
      <>
        {lockNotice && <p className="vault-banner">{lockNotice}</p>}
        <LockedScreen
          status={status}
          onUnlocked={enterVault}
          onForgot={() => setScreen({ name: "recover" })}
          onRefresh={refreshStatus}
        />
      </>
    );
  } else if (screen.name === "note") {
    body = (
      <NoteScreen
        key={screen.noteId}
        noteId={screen.noteId}
        onBack={() => setScreen({ name: "section", sectionId: screen.sectionId })}
        onDeleted={() => { refreshList(); setScreen({ name: "section", sectionId: screen.sectionId }); }}
        onChanged={refreshList}
        onCopied={(field, ms) => setToast({ what: field, until: Date.now() + ms, left: Math.ceil(ms / 1000) })}
      />
    );
  } else if (screen.name === "section" && currentSection) {
    body = (
      <SectionScreen
        section={currentSection}
        notes={sectionNotes}
        onBack={() => setScreen({ name: "sections" })}
        onOpenNote={(noteId) => setScreen({ name: "note", sectionId: currentSection.id, noteId })}
        onAddNote={async (kind) => {
          const res = await vaultApi().add({ kind, parentId: currentSection.id, content: { title: "" } });
          if (!res.ok) return;
          await refreshList();
          setScreen({ name: "note", sectionId: currentSection.id, noteId: res.value });
        }}
        onRename={async (title) => { await vaultApi().update(currentSection.id, { title }); await refreshList(); }}
        onDelete={async () => {
          await vaultApi().remove(currentSection.id);
          await refreshList();
          setScreen({ name: "sections" });
        }}
      />
    );
  } else {
    body = (
      <SectionsScreen
        entries={entries}
        onOpenSection={(sectionId) => setScreen({ name: "section", sectionId })}
        onOpenNote={(sectionId, noteId) => setScreen({ name: "note", sectionId, noteId })}
        onAddSection={async (title, color) => {
          await vaultApi().add({ kind: "section", content: { title, color } });
          await refreshList();
        }}
      />
    );
  }

  return (
    <div className="panel vault-panel">
      <div className="panel-header">
        {tabs}
        <div className="panel-header-right">
          {status && status.state === "unlocked" && (
            <button type="button" className="vault-lock-btn" onClick={lockNow} title="Lock the vault now">
              <LockIcon size={13} /> Lock
            </button>
          )}
          <button type="button" className="panel-close" onClick={onClose} aria-label="Close panel" title="Close">✕</button>
        </div>
      </div>
      <div className="panel-body vault-body">{body}</div>
      {toast && (
        <div className="vault-toast" role="status">
          <span>{toast.what === "password" ? "Password" : toast.what === "username" ? "Username" : "Link"} copied</span>
          <span className="vault-toast-time">clears in {toast.left}s</span>
        </div>
      )}
    </div>
  );
}
