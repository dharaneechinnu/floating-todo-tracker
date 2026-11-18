/*
 * "Launch at login": start FocusDock when the computer starts, so the
 * bubble (and the panel, if it was open) is back after a restart without
 * the user hunting for the app.
 *
 * Windows and macOS: Electron's own login-item setting.
 * Linux: Electron's setting does nothing there, so this writes the
 * freedesktop autostart entry (~/.config/autostart/focusdock.desktop) that
 * GNOME, KDE, Xfce, Cinnamon and others read at login.
 *
 * Everything outside this file is passed in, so it can be tested in Node.
 */
const path = require("path");

const DESKTOP_FILE = "focusdock.desktop";

// A path in an Exec= line is quoted, with \ " ` $ escaped (freedesktop spec).
function quoteExec(value) {
  return `"${String(value).replace(/([\\"`$])/g, "\\$1")}"`;
}

function desktopEntry(command) {
  return [
    "[Desktop Entry]",
    "Type=Application",
    "Name=FocusDock",
    "Comment=Your todo list, docked to the edge of the screen",
    `Exec=${command}`,
    "Terminal=false",
    "X-GNOME-Autostart-enabled=true",
    "",
  ].join("\n");
}

function createAutostart({ app, platform = process.platform, env = process.env, fs, homedir }) {
  const configHome = env.XDG_CONFIG_HOME || path.join(homedir, ".config");
  const entryPath = path.join(configHome, "autostart", DESKTOP_FILE);

  // The AppImage runs from a temporary mount; the file to start at login is
  // the .AppImage itself, which the AppImage runtime names in $APPIMAGE.
  const launcher = () => env.APPIMAGE || process.execPath;

  // Only an installed app registers itself: in development the binary is
  // Electron, which would open an empty window at every login.
  const supported = Boolean(app.isPackaged);

  function isEnabled() {
    if (platform !== "linux") return app.getLoginItemSettings().openAtLogin;
    try {
      const text = fs.readFileSync(entryPath, "utf8");
      return !/^Hidden\s*=\s*true/im.test(text) && !/^X-GNOME-Autostart-enabled\s*=\s*false/im.test(text);
    } catch {
      return false;
    }
  }

  function setEnabled(enabled) {
    if (!supported) return false;
    if (platform !== "linux") {
      app.setLoginItemSettings({ openAtLogin: Boolean(enabled) });
      return isEnabled();
    }
    try {
      if (enabled) {
        fs.mkdirSync(path.dirname(entryPath), { recursive: true });
        fs.writeFileSync(entryPath, desktopEntry(quoteExec(launcher())));
      } else {
        fs.rmSync(entryPath, { force: true });
      }
    } catch (error) {
      console.error("[autostart] couldn't change the login entry:", error.message);
    }
    return isEnabled();
  }

  return { supported, entryPath, isEnabled, setEnabled };
}

module.exports = { createAutostart, desktopEntry, quoteExec };
