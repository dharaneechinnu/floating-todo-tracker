const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, clipboard } = require("electron");
const path = require("path");
const store = require("./store.js");

const isDev = process.env.NODE_ENV === "development";

const BUBBLE_SIZE = 72;
const PANEL_WIDTH = 320;
const PANEL_HEIGHT = 440;
const SCREEN_MARGIN = 24;

// At rest, only this fraction of the bubble stays on-screen; the rest
// hangs off the docked edge and is naturally clipped by the display.
const PEEK_VISIBLE_RATIO = 0.3;
const PEEK_VISIBLE = Math.round(BUBBLE_SIZE * PEEK_VISIBLE_RATIO);
const PEEK_HIDDEN = BUBBLE_SIZE - PEEK_VISIBLE;

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

function settleBubbleAtDock() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.setBounds(bubbleBoundsForDock(dock, true));
  store.set("dock", dock);
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
    if (store.get("expanded")) setExpanded(true);
  });

  // Collapse back to the bubble when the user clicks somewhere else,
  // unless dev tools are focused.
  mainWindow.on("blur", () => {
    if (expanded && !mainWindow.webContents.isDevToolsFocused()) {
      setExpanded(false);
    }
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
  tray.setToolTip("Floating Todo Tracker");
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

function refreshTrayMenu() {
  if (!tray) return;
  const openAtLogin = app.getLoginItemSettings().openAtLogin;

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
      {
        label: "Launch at login",
        type: "checkbox",
        checked: openAtLogin,
        click: (menuItem) => {
          app.setLoginItemSettings({ openAtLogin: menuItem.checked });
        },
      },
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
      "[floating-todo-tracker] Running under native Wayland: always-on-top is not " +
        "supported by the Wayland protocol, so the bubble may end up hidden behind " +
        "other windows. This is an Electron/Wayland limitation, not a bug here."
    );
  }
}

app.whenReady().then(() => {
  warnIfUnsupportedWayland();
  createWindow();
  createTray();

  ipcMain.handle("bubble:toggle-expand", (_event, next) => {
    setExpanded(typeof next === "boolean" ? next : !expanded);
    return expanded;
  });

  ipcMain.handle("bubble:get-expanded", () => expanded);

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
      { id: nextTodoId++, text: trimmed, done: false, createdAt: Date.now(), prNumber: "", blocked: false, feedback: "" },
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

  // Free-form field updates (PR number, blocked flag, feedback note) that
  // don't need the text-specific dedupe/trim rules above.
  ipcMain.handle("todos:patch", (_event, { id, patch }) => {
    const allowed = ["prNumber", "blocked", "feedback"];
    const safePatch = {};
    for (const key of allowed) {
      if (key in patch) safePatch[key] = patch[key];
    }
    todos = todos.map((t) => (t.id === id ? { ...t, ...safePatch } : t));
    store.set("todos", todos);
    return todos;
  });

  ipcMain.handle("clipboard:write", (_event, text) => {
    clipboard.writeText(String(text || ""));
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

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
