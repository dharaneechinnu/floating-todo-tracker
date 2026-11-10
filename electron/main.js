const {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  Tray,
  Menu,
  nativeImage,
  Notification,
  dialog,
  clipboard,
  powerMonitor,
  safeStorage,
  net,
} = require("electron");
const os = require("os");
const path = require("path");
const { randomUUID } = require("crypto");

/*
 * The product was renamed from "Floating Todo Tracker" to "FocusDock".
 * Electron derives the userData folder (where electron-store keeps every
 * todo, the dock position and the focus session) from the app name, which
 * comes from package.json's productName. Without this pin, renaming would
 * point the app at a brand-new, empty folder and every existing user would
 * open to an empty list after upgrading. So keep using the legacy folder
 * name, for new installs as well, so there is only ever one location.
 *
 * This has to run before ./store.js is required, because electron-store
 * resolves its file path when it's constructed. Don't remove it or change
 * the folder name unless you also ship a migration that moves the old
 * config.json over.
 */
const LEGACY_USER_DATA_DIR = "Floating Todo Tracker";
app.setName("FocusDock");
app.setPath("userData", path.join(app.getPath("appData"), LEGACY_USER_DATA_DIR));

const store = require("./store.js");
const fs = require("fs");
const { FEATURES, resolveFeatures, setFeature } = require("./features.js");
const { buildTodoExport, exportFileName } = require("./export.js");
const { createUpdater } = require("./updater.js");
const { createVaultSession } = require("./vault/session.js");
const vaultBackup = require("./vault/backup.js");
const { createVaultSync } = require("./vault/sync.js");
const { createSyncClient } = require("./sync/client.js");
const { defaultServerUrl } = require("./sync/config.js");

const isDev = process.env.NODE_ENV === "development";

/*
 * Pomodoro constants, mirroring src/utils/focusTimer.js — the renderer is
 * ESM and this is CommonJS, so they can't share a module. The renderer's
 * copy formats and displays; this copy is what actually runs the clock.
 */
const PHASE_MINUTES = { focus: 25, short: 5, long: 15 };
const SESSIONS_BEFORE_LONG_BREAK = 4;
const PHASE_DONE_TEXT = {
  focus: "Focus session done",
  short: "Break over",
  long: "Long break over",
};

function phaseDurationMs(phase) {
  return (PHASE_MINUTES[phase] || PHASE_MINUTES.focus) * 60000;
}

function nextPhaseAfter(finishedPhase, completedFocusSessions) {
  if (finishedPhase !== "focus") return "focus";
  return completedFocusSessions > 0 &&
    completedFocusSessions % SESSIONS_BEFORE_LONG_BREAK === 0
    ? "long"
    : "short";
}

const BUBBLE_SIZE = 72;
const PANEL_WIDTH = 320;
const PANEL_HEIGHT = 440;
const SCREEN_MARGIN = 24;

// At rest, only this fraction of the bubble stays on-screen; the rest
// hangs off the docked edge and is naturally clipped by the display.
const PEEK_VISIBLE_RATIO = 0.3;
const PEEK_VISIBLE = Math.round(BUBBLE_SIZE * PEEK_VISIBLE_RATIO);
const PEEK_HIDDEN = BUBBLE_SIZE - PEEK_VISIBLE;

/*
 * Mirrors src/utils/taskMeta.js. The renderer is ESM and this main process
 * is CommonJS, so they can't share a module — but the renderer's copy is
 * only a UX convenience. This copy is the one that actually guards what
 * reaches the store, so if the rules change, change them in both places.
 */
const PRIORITY_IDS = ["p0", "p1", "p2", "p3"];

function isIsoDate(value) {
  if (value === "") return true;
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

let mainWindow = null;
let tray = null;
let expanded = false;
let todos = store.get("todos");
let nextTodoId = store.get("nextTodoId");

// { edge: 'left' | 'right' | 'top' | 'bottom', along: number }
// `along` is the offset from the top (left/right edges) or from the
// left (top/bottom edges) of the docked corner, in workArea coordinates.
let dock = null;

let dragState = null; // { originScreenX, originScreenY, startX, startY }

/*
 * The focus session, or null when idle.
 * { phase, taskId, running, endsAt (running), remainingMs (paused) }
 *
 * A running session stores its wall-clock `endsAt` rather than a countdown,
 * so it stays correct across a machine sleep or a dropped tick — the
 * interval only drives the display, it never *is* the clock.
 */
let session = null;
let focusSessionsCompleted = 0;
let tickHandle = null;

function defaultDock() {
  const { workArea } = screen.getPrimaryDisplay();
  return {
    edge: "right",
    along: workArea.height - BUBBLE_SIZE - SCREEN_MARGIN,
  };
}

function isValidDock(candidate) {
  return (
    candidate &&
    ["left", "right", "top", "bottom"].includes(candidate.edge) &&
    typeof candidate.along === "number"
  );
}

function clampAlong(edge, along, display) {
  const { workArea } = display;
  const span = edge === "left" || edge === "right" ? workArea.height : workArea.width;
  return Math.min(Math.max(along, 0), Math.max(span - BUBBLE_SIZE, 0));
}

function displayForDock() {
  // Docking is always relative to the primary display; this app doesn't
  // track which monitor the bubble was last dragged to across sessions.
  return screen.getPrimaryDisplay();
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

// The peek trick relies on the physical display clipping the hidden 70%
// of the bubble. If another monitor sits flush against that edge, the
// "hidden" part would render fully visible over there instead of being
// clipped — so don't peek in that direction.
function hasAdjacentDisplay(display, edge) {
  const b = display.bounds;
  const TOLERANCE = 2;
  return screen.getAllDisplays().some((other) => {
    if (other.id === display.id) return false;
    const ob = other.bounds;
    switch (edge) {
      case "left":
        return Math.abs(ob.x + ob.width - b.x) <= TOLERANCE && rangesOverlap(ob.y, ob.y + ob.height, b.y, b.y + b.height);
      case "right":
        return Math.abs(ob.x - (b.x + b.width)) <= TOLERANCE && rangesOverlap(ob.y, ob.y + ob.height, b.y, b.y + b.height);
      case "top":
        return Math.abs(ob.y + ob.height - b.y) <= TOLERANCE && rangesOverlap(ob.x, ob.x + ob.width, b.x, b.x + b.width);
      case "bottom":
      default:
        return Math.abs(ob.y - (b.y + b.height)) <= TOLERANCE && rangesOverlap(ob.x, ob.x + ob.width, b.x, b.x + b.width);
    }
  });
}

function bubbleBoundsForDock(currentDock, peeking) {
  const display = displayForDock(currentDock);
  const { workArea } = display;
  const along = clampAlong(currentDock.edge, currentDock.along, display);
  const hiddenOffset = peeking && !hasAdjacentDisplay(display, currentDock.edge) ? PEEK_HIDDEN : 0;

  switch (currentDock.edge) {
    case "left":
      return { x: workArea.x - hiddenOffset, y: workArea.y + along, width: BUBBLE_SIZE, height: BUBBLE_SIZE };
    case "right":
      return {
        x: workArea.x + workArea.width - BUBBLE_SIZE + hiddenOffset,
        y: workArea.y + along,
        width: BUBBLE_SIZE,
        height: BUBBLE_SIZE,
      };
    case "top":
      return { x: workArea.x + along, y: workArea.y - hiddenOffset, width: BUBBLE_SIZE, height: BUBBLE_SIZE };
    case "bottom":
    default:
      return {
        x: workArea.x + along,
        y: workArea.y + workArea.height - BUBBLE_SIZE + hiddenOffset,
        width: BUBBLE_SIZE,
        height: BUBBLE_SIZE,
      };
  }
}

function clampToDisplay(bounds, display) {
  const { x: dx, y: dy, width: dw, height: dh } = display.workArea;
  const x = Math.min(Math.max(bounds.x, dx), dx + dw - bounds.width);
  const y = Math.min(Math.max(bounds.y, dy), dy + dh - bounds.height);
  return { ...bounds, x, y };
}

function panelBoundsForDock(currentDock) {
  const display = displayForDock(currentDock);
  const { workArea } = display;
  const along = clampAlong(currentDock.edge, currentDock.along, display);

  let raw;
  switch (currentDock.edge) {
    case "left":
      raw = { x: workArea.x, y: workArea.y + along, width: PANEL_WIDTH, height: PANEL_HEIGHT };
      break;
    case "right":
      raw = {
        x: workArea.x + workArea.width - PANEL_WIDTH,
        y: workArea.y + along,
        width: PANEL_WIDTH,
        height: PANEL_HEIGHT,
      };
      break;
    case "top":
      raw = { x: workArea.x + along, y: workArea.y, width: PANEL_WIDTH, height: PANEL_HEIGHT };
      break;
    case "bottom":
    default:
      raw = {
        x: workArea.x + along,
        y: workArea.y + workArea.height - PANEL_HEIGHT,
        width: PANEL_WIDTH,
        height: PANEL_HEIGHT,
      };
      break;
  }

  return clampToDisplay(raw, display);
}

// Figure out which of the four screen edges a resting bubble/panel is
// closest to, from its current (fully on-screen) bounds.
function nearestDockFromBounds(bounds) {
  const display = screen.getDisplayMatching(bounds);
  const { workArea } = display;
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;

  const distLeft = centerX - workArea.x;
  const distRight = workArea.x + workArea.width - centerX;
  const distTop = centerY - workArea.y;
  const distBottom = workArea.y + workArea.height - centerY;

  const min = Math.min(distLeft, distRight, distTop, distBottom);

  if (min === distLeft) {
    return { edge: "left", along: clampAlong("left", bounds.y - workArea.y, display) };
  }
  if (min === distRight) {
    return { edge: "right", along: clampAlong("right", bounds.y - workArea.y, display) };
  }
  if (min === distTop) {
    return { edge: "top", along: clampAlong("top", bounds.x - workArea.x, display) };
  }
  return { edge: "bottom", along: clampAlong("bottom", bounds.x - workArea.x, display) };
}

// The renderer needs the docked edge to place the pending-count badge on
// whichever sliver of the bubble is still on-screen — at rest ~70% of it
// hangs off the docked edge and is clipped away by the display.
function notifyDockEdge() {
  if (!mainWindow || mainWindow.isDestroyed() || !dock) return;
  mainWindow.webContents.send("bubble:dock-edge", dock.edge);
}

function settleBubbleAtDock() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.setBounds(bubbleBoundsForDock(dock, true));
  store.set("dock", dock);
  notifyDockEdge();
}

/* ---------------------------- focus timer ---------------------------- */

function sessionRemainingMs(now) {
  if (!session) return 0;
  if (!session.running) return Math.max(0, session.remainingMs || 0);
  return Math.max(0, (session.endsAt || 0) - (now === undefined ? Date.now() : now));
}

function sessionSnapshot() {
  if (!session) {
    return { active: false, focusSessionsCompleted };
  }
  return {
    active: true,
    phase: session.phase,
    taskId: session.taskId,
    running: session.running,
    remainingMs: sessionRemainingMs(),
    focusSessionsCompleted,
  };
}

function broadcastSession() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send("focus:state", sessionSnapshot());
}

function persistSession() {
  store.set("session", session);
  store.set("focusSessionsCompleted", focusSessionsCompleted);
}

function stopTicking() {
  if (tickHandle) {
    clearInterval(tickHandle);
    tickHandle = null;
  }
}

function startTicking() {
  stopTicking();
  // 1s only drives the on-screen clock; `endsAt` is the real deadline, so a
  // late or missed tick can't make the session run long.
  tickHandle = setInterval(function () {
    if (!session || !session.running) {
      stopTicking();
      return;
    }
    if (sessionRemainingMs() <= 0) {
      finishPhase();
      return;
    }
    broadcastSession();
  }, 1000);
}

function notify(title, body) {
  // Never let a notification failure take down the timer — on Linux this
  // depends on a libnotify-compatible daemon actually being present.
  try {
    if (!Notification.isSupported()) return;
    new Notification({ title: title, body: body, silent: false }).show();
  } catch (err) {
    console.warn("[focusdock] notification failed:", err.message);
  }
}

function taskTextFor(id) {
  const match = todos.find(function (t) { return t.id === id; });
  return match ? match.text : "";
}

function finishPhase() {
  if (!session) return;
  const finished = session.phase;
  const taskId = session.taskId;

  if (finished === "focus") {
    focusSessionsCompleted += 1;
    // Credit the pomodoro to the task it was started on.
    if (taskId !== null && taskId !== undefined) {
      todos = todos.map(function (t) {
        return t.id === taskId ? { ...t, pomodoros: (t.pomodoros || 0) + 1 } : t;
      });
      store.set("todos", todos);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("todos:changed", todos);
      }
    }
  }

  const upcoming = nextPhaseAfter(finished, focusSessionsCompleted);

  // Queue the next phase paused rather than auto-running it. The break is
  // mandatory in the technique, but starting it without the person noticing
  // means the break silently elapses while they keep typing.
  session = {
    phase: upcoming,
    taskId: taskId,
    running: false,
    remainingMs: phaseDurationMs(upcoming),
  };

  stopTicking();
  persistSession();
  broadcastSession();

  const label = finished === "focus" ? taskTextFor(taskId) : "";
  notify(
    PHASE_DONE_TEXT[finished] || "Session done",
    upcoming === "focus"
      ? "Ready for the next focus session."
      : label
        ? `"${label}" — time for a ${upcoming === "long" ? "long " : ""}break.`
        : `Time for a ${upcoming === "long" ? "long " : ""}break.`
  );
}

function startSession(phase, taskId) {
  const duration = phaseDurationMs(phase);
  session = {
    phase: phase,
    taskId: taskId === undefined ? null : taskId,
    running: true,
    endsAt: Date.now() + duration,
  };
  persistSession();
  broadcastSession();
  startTicking();
}

function pauseSession() {
  if (!session || !session.running) return;
  session = {
    phase: session.phase,
    taskId: session.taskId,
    running: false,
    remainingMs: sessionRemainingMs(),
  };
  stopTicking();
  persistSession();
  broadcastSession();
}

function resumeSession() {
  if (!session || session.running) return;
  session = {
    phase: session.phase,
    taskId: session.taskId,
    running: true,
    endsAt: Date.now() + Math.max(0, session.remainingMs || 0),
  };
  persistSession();
  broadcastSession();
  startTicking();
}

function stopSession() {
  session = null;
  stopTicking();
  persistSession();
  broadcastSession();
}

/*
 * Cirillo's rule is that an interrupted pomodoro is void rather than
 * partially credited, and quitting the app mid-session is an interruption.
 * So a focus session is discarded on restart instead of being resumed or
 * counted. A queued (paused) break is harmless to keep.
 */
function restoreSession() {
  const saved = store.get("session");
  focusSessionsCompleted = store.get("focusSessionsCompleted") || 0;

  if (!saved || !PHASE_MINUTES[saved.phase]) {
    session = null;
    return;
  }

  if (saved.phase === "focus" && saved.running) {
    session = null;
    persistSession();
    return;
  }

  // Anything else comes back paused — never mid-flight, since wall-clock
  // time kept moving while the app was closed.
  session = {
    phase: saved.phase,
    taskId: saved.taskId === undefined ? null : saved.taskId,
    running: false,
    remainingMs: saved.running
      ? phaseDurationMs(saved.phase)
      : Math.max(0, saved.remainingMs || 0),
  };
  persistSession();
}

function createWindow() {
  dock = isValidDock(store.get("dock")) ? store.get("dock") : defaultDock();
  const { x, y, width, height } = bubbleBoundsForDock(dock, true);

  mainWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.setAlwaysOnTop(true, "screen-saver");
  // skipTransformProcessType avoids macOS flashing the Dock icon every
  // time this toggles (setVisibleOnAllWorkspaces otherwise switches the
  // app between UIElement and Foreground process types on each call).
  mainWindow.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true,
    skipTransformProcessType: true,
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    broadcastSession();
    notifyDockEdge();
    if (store.get("expanded")) setExpanded(true);
  });

  return mainWindow;
}

function setExpanded(next) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  expanded = next;

  if (expanded) {
    mainWindow.setBounds(panelBoundsForDock(dock));
  } else {
    // The panel may have been dragged (by its header) before collapsing,
    // so re-derive the nearest edge from wherever it ended up.
    dock = nearestDockFromBounds(mainWindow.getBounds());
    settleBubbleAtDock();
  }

  store.set("expanded", expanded);
  mainWindow.webContents.send("bubble:expanded-state", expanded);
}

function createTray() {
  const iconFile = path.join(__dirname, "tray-icon@2x.png");
  const icon = nativeImage.createFromPath(iconFile).resize({ width: 18, height: 18 });
  if (process.platform === "darwin") icon.setTemplateImage(true);

  tray = new Tray(icon);
  tray.setToolTip("FocusDock");
  refreshTrayMenu();

  tray.on("click", () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.focus();
    } else {
      mainWindow.show();
    }
    refreshTrayMenu();
  });
}

let updater = null;
let vault = null;

/*
 * Vault IPC. Every call goes through here so that a thrown error reaches
 * the renderer as { ok: false, code, message } rather than Electron's
 * generic "Error invoking remote method". The vault feature switch is
 * checked here too: the main process is the real gate, not the UI.
 */
function handleVault(channel, fn) {
  ipcMain.handle(channel, async (_event, ...args) => {
    if (!currentFeatures().vault) {
      return { ok: false, code: "disabled", message: "Turn on Secret vault under Beta features in the tray." };
    }
    try {
      return { ok: true, value: await fn(...args) };
    } catch (error) {
      if (!error.code) console.error(`[vault] ${channel}:`, error);
      return {
        ok: false,
        code: error.code || "error",
        message: error.code ? error.message : "Something went wrong in the vault.",
        waitMs: error.waitMs,
      };
    }
  });
}

/*
 * The signed-in account, kept in account.json next to the vault. The
 * refresh token is encrypted by the operating system (DPAPI on Windows,
 * the keyring on Linux) before it touches the disk. Where that isn't
 * available the token is simply not saved, and the account signs out when
 * the app quits: asking for the password again beats a readable token.
 */
function accountTokenStore() {
  const file = path.join(app.getPath("userData"), "account.json");
  return {
    load() {
      try {
        const saved = JSON.parse(fs.readFileSync(file, "utf8"));
        const out = { serverUrl: saved.serverUrl || "" };
        if (saved.user && saved.token && safeStorage.isEncryptionAvailable()) {
          out.user = saved.user;
          out.refreshToken = safeStorage.decryptString(Buffer.from(saved.token, "base64"));
        }
        return out;
      } catch {
        return null; // no file yet, or one this computer can't decrypt
      }
    },
    save({ serverUrl, user, refreshToken }) {
      const out = { serverUrl: serverUrl || "" };
      if (user && refreshToken && safeStorage.isEncryptionAvailable()) {
        out.user = user;
        out.token = safeStorage.encryptString(refreshToken).toString("base64");
      }
      try {
        fs.writeFileSync(file, JSON.stringify(out, null, 2), { mode: 0o600 });
      } catch (error) {
        console.error("[sync] couldn't save the account:", error.message);
      }
    },
  };
}

const SYNC_AFTER_EDIT_MS = 3000;
const SYNC_EVERY_MS = 5 * 60 * 1000;
let vaultSync = null;
let syncClient = null;
let syncSoonTimer = null;
let pickedBackup = null; // the backup file chosen in "Restore from a backup", until it's imported

function sendToPanel(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

// Background sync, only with both switches on. Errors stay in the sync
// status line; they never interrupt the user.
function syncInBackground() {
  const features = currentFeatures();
  if (!features.vault || !features.sync || !vaultSync) return;
  vaultSync.syncQuietly();
}

function syncSoon() {
  clearTimeout(syncSoonTimer);
  syncSoonTimer = setTimeout(syncInBackground, SYNC_AFTER_EDIT_MS);
}

// Like handleVault, for the calls that also need the sync switch.
function handleSync(channel, fn) {
  handleVault(channel, (...args) => {
    if (!currentFeatures().sync) {
      const error = new Error("Turn on Sync with an account under Beta features in the tray.");
      error.code = "disabled";
      throw error;
    }
    return fn(...args);
  });
}

async function exportVaultBackup() {
  const backup = vault.exportBackup(); // throws if locked, before any dialog opens
  // Parented to the panel: it floats above every window, and an unparented
  // dialog could open underneath it.
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: "Back up your vault",
    defaultPath: path.join(app.getPath("documents"), vaultBackup.backupFileName()),
    filters: [{ name: "FocusDock vault backup", extensions: ["fdvault"] }],
  });
  if (canceled || !filePath) return { saved: false };
  fs.writeFileSync(filePath, JSON.stringify(backup, null, 2), { mode: 0o600 });
  return { saved: true, name: path.basename(filePath), count: backup.count };
}

async function pickVaultBackup() {
  vault.list(); // refuses while locked, before any dialog opens
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: "Restore from a vault backup",
    defaultPath: app.getPath("documents"),
    properties: ["openFile"],
    filters: [{ name: "FocusDock vault backup", extensions: ["fdvault", "json"] }],
  });
  if (canceled || !filePaths.length) return { picked: false };
  const backup = vaultBackup.readBackup(fs.readFileSync(filePaths[0], "utf8"));
  pickedBackup = backup;
  return { picked: true, name: path.basename(filePaths[0]), ...vault.inspectBackup(backup) };
}

async function importVaultBackup(secret) {
  if (!pickedBackup) {
    const error = new Error("Choose a backup file first.");
    error.code = "no_backup";
    throw error;
  }
  const result = await vault.importBackup(pickedBackup, secret);
  pickedBackup = null;
  return result;
}

function registerVaultIpc() {
  vault = createVaultSession({
    filePath: path.join(app.getPath("userData"), "vault.json"),
    clipboard,
    appVersion: app.getVersion(),
    onLock: (reason) => {
      pickedBackup = null;
      sendToPanel("vault:locked", reason);
    },
    onChange: syncSoon,
  });

  syncClient = createSyncClient({
    fetchImpl: (url, options) => net.fetch(url, options),
    tokenStore: accountTokenStore(),
    appVersion: app.getVersion(),
    device: os.hostname().slice(0, 100),
    defaultServerUrl: defaultServerUrl(),
    onAccountChange: () => sendToPanel("sync:state", vaultSync.status()),
  });
  vaultSync = createVaultSync({
    session: vault,
    client: syncClient,
    onState: (state) => sendToPanel("sync:state", state),
  });
  setInterval(syncInBackground, SYNC_EVERY_MS);
  powerMonitor.on("resume", syncSoon);

  // Lock when the computer sleeps or the screen locks.
  powerMonitor.on("lock-screen", () => vault.lock("screen"));
  powerMonitor.on("suspend", () => vault.lock("sleep"));
  app.on("before-quit", () => vault.lock("quit"));

  handleVault("vault:status", () => vault.status());
  handleVault("vault:create", (passphrase) => vault.create(passphrase));
  handleVault("vault:unlock", async (passphrase) => {
    const status = await vault.unlock(passphrase);
    syncSoon(); // pick up what other computers changed while this one was locked
    return status;
  });
  handleVault("vault:recover", ({ recoveryCode, passphrase } = {}) => vault.recover(recoveryCode, passphrase));
  handleVault("vault:change-passphrase", ({ current, next } = {}) => vault.changePassphrase(current, next));
  handleVault("vault:export-backup", () => exportVaultBackup());
  handleVault("vault:pick-backup", () => pickVaultBackup());
  handleVault("vault:import-backup", (secret) => importVaultBackup(secret));

  // Account and sync. Passwords and the vault passphrase arrive here and
  // go no further than the sign-in request and the key derivation.
  handleSync("sync:status", () => vaultSync.status());
  handleSync("sync:sign-in", async ({ server, email, password, create } = {}) => {
    vaultSync.clearError();
    await syncClient.signIn({ server, email, password, create: Boolean(create) });
    return vaultSync.status();
  });
  handleSync("sync:sign-out", async () => {
    await syncClient.signOut();
    vaultSync.clearError();
    return vaultSync.status();
  });
  handleSync("sync:remote", () => vaultSync.remote());
  handleSync("sync:link", async () => ({ result: await vaultSync.link(), status: vaultSync.status() }));
  handleSync("sync:join", async (passphrase) => ({ result: await vaultSync.join(passphrase), status: vaultSync.status() }));
  handleSync("sync:now", async () => ({ result: await vaultSync.syncNow(), status: vaultSync.status() }));
  handleSync("sync:delete-account", async (password) => {
    await syncClient.deleteAccount(password);
    vaultSync.clearError();
    return vaultSync.status();
  });
  handleVault("vault:lock", () => vault.lock("manual"));
  handleVault("vault:list", () => vault.list());
  handleVault("vault:open", (id) => vault.open(id));
  handleVault("vault:add", (item) => vault.add(item || {}));
  handleVault("vault:update", ({ id, changes } = {}) => vault.update(id, changes));
  handleVault("vault:remove", (id) => vault.remove(id));
  handleVault("vault:copy", ({ id, field } = {}) => vault.copy(id, field));
}

function currentFeatures() {
  return resolveFeatures(store.get("features"));
}

function toggleFeature(name, enabled) {
  store.set("features", setFeature(store.get("features"), name, enabled));
  if (name === "vault" && !enabled && vault) vault.lock("disabled");
  if (mainWindow) mainWindow.webContents.send("features:changed", currentFeatures());
  refreshTrayMenu();
}

/*
 * Save every task to a JSON file the user picks. Closes the "losing the
 * store file loses everything" gap until vault backups and sync arrive.
 */
async function exportTasks() {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: "Export tasks",
    defaultPath: path.join(app.getPath("documents"), exportFileName()),
    filters: [{ name: "FocusDock export", extensions: ["json"] }],
  });
  if (canceled || !filePath) return;

  const payload = buildTodoExport(todos, {
    appVersion: app.getVersion(),
    schemaVersion: store.get("schemaVersion"),
  });
  try {
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
    notify("Tasks exported", `${payload.count} tasks saved to ${path.basename(filePath)}`);
  } catch (error) {
    dialog.showMessageBox({
      type: "error",
      message: "FocusDock couldn't save the export.",
      detail: `${error.message}\n\nPick a folder you can write to and try again.`,
    });
  }
}

function updateMenuItem() {
  const state = updater ? updater.getState() : { enabled: false };
  if (!state.enabled) return { label: "Updates work in the installed app", enabled: false };
  if (state.status === "ready") {
    return { label: `Restart to update to ${state.version}`, click: () => updater.installNow() };
  }
  if (state.status === "downloading") return { label: `Downloading ${state.version}…`, enabled: false };
  if (state.status === "checking") return { label: "Checking for updates…", enabled: false };
  return { label: "Check for updates", click: () => updater.checkNow() };
}

function refreshTrayMenu() {
  if (!tray) return;
  const openAtLogin = app.getLoginItemSettings().openAtLogin;
  const features = currentFeatures();

  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: mainWindow && mainWindow.isVisible() ? "Hide bubble" : "Show bubble",
        click: () => {
          if (!mainWindow) return;
          if (mainWindow.isVisible()) {
            mainWindow.hide();
          } else {
            mainWindow.show();
          }
          refreshTrayMenu();
        },
      },
      { type: "separator" },
      { label: "Export tasks…", click: () => exportTasks() },
      { type: "separator" },
      {
        label: "Launch at login",
        type: "checkbox",
        checked: openAtLogin,
        click: (menuItem) => {
          app.setLoginItemSettings({ openAtLogin: menuItem.checked });
        },
      },
      {
        label: "Beta features",
        submenu: [
          ...Object.entries(FEATURES).map(([name, def]) => ({
            label: def.label,
            type: "checkbox",
            checked: features[name],
            click: (menuItem) => toggleFeature(name, menuItem.checked),
          })),
          { type: "separator" },
          {
            label: "Get beta updates",
            type: "checkbox",
            checked: store.get("updateChannel") === "beta",
            click: (menuItem) => {
              const channel = menuItem.checked ? "beta" : "stable";
              store.set("updateChannel", channel);
              if (updater) updater.setChannel(channel);
              refreshTrayMenu();
            },
          },
        ],
      },
      updateMenuItem(),
      { type: "separator" },
      { label: "Quit", click: () => app.quit() },
    ])
  );
}

function warnIfUnsupportedWayland() {
  // The Wayland protocol has no always-on-top concept, so a native
  // Wayland session (not XWayland) can bury the bubble under other
  // windows with no code-level fix — this is a known Electron limitation,
  // not a bug in this app. Surface it instead of failing silently.
  if (process.platform === "linux" && process.env.XDG_SESSION_TYPE === "wayland") {
    console.warn(
      "[focusdock] Running under native Wayland: always-on-top is not " +
        "supported by the Wayland protocol, so the bubble may end up hidden behind " +
        "other windows. This is an Electron/Wayland limitation, not a bug here."
    );
  }
}

/*
 * store.js refuses to write when the data file is newer than this build or
 * a migration failed (VERSIONING.md, R2/R3). Tell the user once, plainly,
 * instead of letting their edits silently vanish on quit.
 */
function warnIfDataReadOnly() {
  const status = store.dataStatus || {};
  if (status.status !== "newer" && status.status !== "failed") return;

  const message =
    status.status === "newer"
      ? "This data was saved by a newer version of FocusDock."
      : "FocusDock couldn't update your data to this version. Nothing was changed.";
  const detail =
    (status.status === "newer"
      ? "Update FocusDock to keep editing. "
      : "Please report this so it can be fixed. ") +
    "Until then your list opens read-only, and changes you make won't be saved.\n\n" +
    `Data file: ${status.path}`;

  if (status.error) console.error("[store] migration failed:", status.error);
  dialog.showMessageBox({ type: "warning", message, detail, buttons: ["OK"] });
}

app.whenReady().then(() => {
  warnIfUnsupportedWayland();
  warnIfDataReadOnly();
  updater = createUpdater({
    app,
    channel: store.get("updateChannel") === "beta" ? "beta" : "stable",
    onChange: (state) => {
      refreshTrayMenu();
      if (state.status === "ready") {
        notify("Update ready", `FocusDock ${state.version} installs when you quit, or restart from the tray.`);
      }
    },
  });
  restoreSession();
  createWindow();
  createTray();

  ipcMain.handle("focus:get", () => sessionSnapshot());

  ipcMain.handle("focus:start", (_event, { phase, taskId } = {}) => {
    const wanted = PHASE_MINUTES[phase] ? phase : "focus";
    startSession(wanted, taskId === undefined ? null : taskId);
    return sessionSnapshot();
  });

  ipcMain.handle("focus:pause", () => {
    pauseSession();
    return sessionSnapshot();
  });

  ipcMain.handle("focus:resume", () => {
    resumeSession();
    return sessionSnapshot();
  });

  ipcMain.handle("focus:stop", () => {
    stopSession();
    return sessionSnapshot();
  });

  ipcMain.handle("bubble:toggle-expand", (_event, next) => {
    setExpanded(typeof next === "boolean" ? next : !expanded);
    return expanded;
  });

  ipcMain.handle("bubble:get-expanded", () => expanded);

  ipcMain.handle("bubble:get-dock-edge", () => (dock ? dock.edge : null));

  // Custom drag handling for the collapsed bubble. It can't use native
  // -webkit-app-region: drag because that swallows plain clicks along with
  // drags, which is what used to stop the tracker sheet from opening at
  // all. Instead the renderer tracks the pointer itself and only calls
  // these once real movement (not just a click) is detected.
  ipcMain.on("bubble:drag-start", (_event, { screenX, screenY }) => {
    if (expanded || !mainWindow || mainWindow.isDestroyed()) return;
    const bounds = mainWindow.getBounds();
    dragState = { originScreenX: screenX, originScreenY: screenY, startX: bounds.x, startY: bounds.y };
  });

  ipcMain.on("bubble:drag-move", (_event, { screenX, screenY }) => {
    if (!dragState || expanded || !mainWindow || mainWindow.isDestroyed()) return;
    const x = dragState.startX + (screenX - dragState.originScreenX);
    const y = dragState.startY + (screenY - dragState.originScreenY);
    mainWindow.setBounds({ x, y, width: BUBBLE_SIZE, height: BUBBLE_SIZE });
  });

  ipcMain.on("bubble:drag-end", () => {
    if (!dragState || expanded || !mainWindow || mainWindow.isDestroyed()) {
      dragState = null;
      return;
    }
    dragState = null;
    dock = nearestDockFromBounds(mainWindow.getBounds());
    settleBubbleAtDock();
  });

  ipcMain.handle("features:get", () => currentFeatures());
  registerVaultIpc();

  ipcMain.handle("todos:get", () => todos);

  ipcMain.handle("todos:add", (_event, text) => {
    const trimmed = String(text || "").trim();
    if (!trimmed) return todos;
    // The renderer already blocks this via its own search-match check, but
    // enforce it here too so it holds regardless of caller.
    const isDuplicate = todos.some((t) => t.text.trim().toLowerCase() === trimmed.toLowerCase());
    if (isDuplicate) return todos;
    todos = [
      ...todos,
      {
        id: nextTodoId++,
        uid: randomUUID(),
        text: trimmed,
        done: false,
        createdAt: Date.now(),
        prNumber: "",
        blocked: false,
        feedback: "",
        pomodoros: 0,
        priority: "",
        dueDate: "",
      },
    ];
    store.set("todos", todos);
    store.set("nextTodoId", nextTodoId);
    return todos;
  });

  ipcMain.handle("todos:toggle", (_event, id) => {
    todos = todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
    store.set("todos", todos);
    return todos;
  });

  ipcMain.handle("todos:delete", (_event, id) => {
    todos = todos.filter((t) => t.id !== id);
    store.set("todos", todos);
    // A session pinned to a task that no longer exists would credit its
    // pomodoro to nothing when it lands — end it instead.
    if (session && session.taskId === id) stopSession();
    return todos;
  });

  ipcMain.handle("todos:clear-completed", () => {
    todos = todos.filter((t) => !t.done);
    store.set("todos", todos);
    return todos;
  });

  ipcMain.handle("todos:complete-many", (_event, ids) => {
    const idSet = new Set(ids);
    todos = todos.map((t) => (idSet.has(t.id) ? { ...t, done: true } : t));
    store.set("todos", todos);
    return todos;
  });

  ipcMain.handle("todos:delete-many", (_event, ids) => {
    const idSet = new Set(ids);
    todos = todos.filter((t) => !idSet.has(t.id));
    store.set("todos", todos);
    if (session && idSet.has(session.taskId)) stopSession();
    return todos;
  });

  ipcMain.handle("todos:edit", (_event, { id, text }) => {
    const trimmed = String(text || "").trim();
    if (!trimmed) return todos;
    const isDuplicate = todos.some(
      (t) => t.id !== id && t.text.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (isDuplicate) return todos;
    todos = todos.map((t) => (t.id === id ? { ...t, text: trimmed } : t));
    store.set("todos", todos);
    return todos;
  });

  // Free-form field updates (PR number, blocked flag, feedback note,
  // priority, due date) that don't need the text-specific dedupe/trim
  // rules above.
  ipcMain.handle("todos:patch", (_event, { id, patch }) => {
    const allowed = ["prNumber", "blocked", "feedback", "priority", "dueDate"];
    const safePatch = {};
    for (const key of allowed) {
      if (key in patch) safePatch[key] = patch[key];
    }

    // Priority and due date drive sorting, so a malformed value would
    // corrupt the list order for every view. Normalise both to "" rather
    // than storing something the renderer can't sort on. The renderer
    // validates too; this is the gate that actually holds.
    if ("priority" in safePatch && !PRIORITY_IDS.includes(safePatch.priority)) {
      safePatch.priority = "";
    }
    if ("dueDate" in safePatch && !isIsoDate(safePatch.dueDate)) {
      safePatch.dueDate = "";
    }

    todos = todos.map((t) => (t.id === id ? { ...t, ...safePatch } : t));
    store.set("todos", todos);
    return todos;
  });

  ipcMain.handle("todos:reorder", (_event, orderedIds) => {
    const byId = new Map(todos.map((t) => [t.id, t]));
    const reordered = orderedIds.map((id) => byId.get(id)).filter(Boolean);
    // Guard against a stale/partial id list from the renderer.
    todos = reordered.length === todos.length ? reordered : todos;
    store.set("todos", todos);
    return todos;
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => {
  stopTicking();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
