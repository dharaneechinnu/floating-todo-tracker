const { app, BrowserWindow, ipcMain, screen } = require("electron");
const path = require("path");

const isDev = process.env.NODE_ENV === "development";

const BUBBLE_SIZE = 72;
const PANEL_WIDTH = 320;
const PANEL_HEIGHT = 440;
const SCREEN_MARGIN = 24;

let mainWindow = null;
let expanded = false;

function defaultBubblePosition() {
  const { workArea } = screen.getPrimaryDisplay();
  return {
    x: workArea.x + workArea.width - BUBBLE_SIZE - SCREEN_MARGIN,
    y: workArea.y + workArea.height - BUBBLE_SIZE - SCREEN_MARGIN,
  };
}

function clampToDisplay(bounds) {
  const display = screen.getDisplayMatching(bounds);
  const { x: dx, y: dy, width: dw, height: dh } = display.workArea;
  const x = Math.min(Math.max(bounds.x, dx), dx + dw - bounds.width);
  const y = Math.min(Math.max(bounds.y, dy), dy + dh - bounds.height);
  return { ...bounds, x, y };
}

function createWindow() {
  const { x, y } = defaultBubblePosition();

  mainWindow = new BrowserWindow({
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
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
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
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

  const current = mainWindow.getBounds();
  const size = expanded
    ? { width: PANEL_WIDTH, height: PANEL_HEIGHT }
    : { width: BUBBLE_SIZE, height: BUBBLE_SIZE };

  // Grow/shrink from whichever corner the bubble is currently anchored to,
  // so expanding never sends the panel off-screen.
  const display = screen.getDisplayMatching(current);
  const centerX = current.x + current.width / 2;
  const anchorRight = centerX > display.workArea.x + display.workArea.width / 2;

  const nextBounds = clampToDisplay({
    x: anchorRight ? current.x + current.width - size.width : current.x,
    y: current.y,
    width: size.width,
    height: size.height,
  });

  mainWindow.setResizable(true);
  mainWindow.setBounds(nextBounds);
  mainWindow.setResizable(false);

  mainWindow.webContents.send("bubble:expanded-state", expanded);
}

app.whenReady().then(() => {
  createWindow();

  ipcMain.handle("bubble:toggle-expand", (_event, next) => {
    setExpanded(typeof next === "boolean" ? next : !expanded);
    return expanded;
  });

  ipcMain.handle("bubble:get-expanded", () => expanded);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
