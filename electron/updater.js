/*
 * Automatic updates from GitHub Releases (electron-updater).
 *
 * Only runs in an installed build: in `npm run dev` there is nothing to
 * update. Updates download in the background and install the next time
 * the app quits; the tray also offers "Restart to update".
 *
 * Two channels. "stable" only sees normal releases. "beta" also sees
 * pre-releases (tags like v0.3.0-beta.1). On Linux only the AppImage and
 * the .deb can update themselves.
 */
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
const FIRST_CHECK_AFTER_MS = 15 * 1000;

function createUpdater({ app, channel = "stable", onChange = () => {} }) {
  const state = { status: "idle", version: null, channel, enabled: app.isPackaged };
  const emit = (patch) => {
    Object.assign(state, patch);
    onChange({ ...state });
  };

  if (!app.isPackaged) {
    return {
      getState: () => ({ ...state }),
      setChannel: (next) => emit({ channel: next }),
      checkNow: () => {},
      installNow: () => {},
    };
  }

  const { autoUpdater } = require("electron-updater");
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = channel === "beta";
  autoUpdater.allowDowngrade = false;
  autoUpdater.logger = console;

  autoUpdater.on("checking-for-update", () => emit({ status: "checking" }));
  autoUpdater.on("update-available", (info) => emit({ status: "downloading", version: info.version }));
  autoUpdater.on("update-not-available", () => emit({ status: "current" }));
  autoUpdater.on("update-downloaded", (info) => emit({ status: "ready", version: info.version }));
  // Being offline or GitHub being slow is normal; never interrupt the user for it.
  autoUpdater.on("error", (error) => {
    console.warn("[updater]", error && error.message);
    emit({ status: "error" });
  });

  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  setTimeout(check, FIRST_CHECK_AFTER_MS);
  setInterval(check, CHECK_EVERY_MS);

  return {
    getState: () => ({ ...state }),
    setChannel(next) {
      autoUpdater.allowPrerelease = next === "beta";
      emit({ channel: next });
      check();
    },
    checkNow: check,
    installNow: () => autoUpdater.quitAndInstall(),
  };
}

module.exports = { createUpdater };
