import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { filterTodos, sortTodos, searchTodos } from "../src/utils/taskMeta.js";
import undoModule from "../electron/todoUndo.js";
import autostartModule from "../electron/autostart.js";

const { removeTodos, restoreTodos } = undoModule;
const { createAutostart, quoteExec } = autostartModule;

const NOW = new Date(2026, 10, 18, 10, 0);
const list = [
  { id: 1, text: "Reply to design review", done: false, priority: "", dueDate: "" },
  { id: 2, text: "Review billing PR", done: false, priority: "p0", dueDate: "2026-11-16" },
  { id: 3, text: "Write audit migration", done: false, priority: "p1", dueDate: "2026-11-18" },
  { id: 4, text: "Fix flaky test", done: true, priority: "p1", dueDate: "2026-11-10" },
  { id: 5, text: "Update runbook", done: false, priority: "p2", dueDate: "2026-11-21" },
  { id: 6, text: "Book 1:1", done: false, priority: "", dueDate: "2026-11-19" },
];
const ids = (todos) => todos.map((t) => t.id);

describe("filters", () => {
  it("All shows everything, Open hides finished tasks", () => {
    expect(ids(filterTodos(list, "all", NOW))).toEqual([1, 2, 3, 4, 5, 6]);
    expect(ids(filterTodos(list, "open", NOW))).toEqual([1, 2, 3, 5, 6]);
  });

  it("Late shows open tasks past their due date, never finished ones", () => {
    expect(ids(filterTodos(list, "late", NOW))).toEqual([2]);
  });

  it("P0–P1 shows open critical and high tasks", () => {
    expect(ids(filterTodos(list, "top", NOW))).toEqual([2, 3]);
  });
});

describe("sorting", () => {
  it("leaves the stored order alone for My order", () => {
    expect(sortTodos(list, "manual", NOW)).toBe(list);
  });

  it("sorts by priority, unprioritised last, due date breaking ties", () => {
    expect(ids(sortTodos(list, "priority", NOW))).toEqual([2, 4, 3, 5, 6, 1]);
  });

  it("sorts by due date, undated last, and never changes the stored list", () => {
    const before = ids(list);
    expect(ids(sortTodos(list, "due", NOW))).toEqual([4, 2, 3, 6, 5, 1]);
    expect(ids(list)).toEqual(before);
  });
});

describe("search", () => {
  it("matches any part of the text, ignoring case", () => {
    expect(ids(searchTodos(list, "REVIEW"))).toEqual([1, 2]);
    expect(searchTodos(list, "  ")).toBe(list);
  });
});

describe("undo", () => {
  it("puts deleted tasks back exactly where they were", () => {
    const { todos, removed } = removeTodos(list, (t) => t.id === 2 || t.id === 5);
    expect(ids(todos)).toEqual([1, 3, 4, 6]);
    expect(ids(restoreTodos(todos, removed))).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("restores cleared tasks after a task was added in the meantime", () => {
    const { todos, removed } = removeTodos(list, (t) => t.done);
    const later = [...todos, { id: 7, text: "New", done: false }];
    expect(ids(restoreTodos(later, removed))).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("never duplicates a task when Undo runs twice", () => {
    const { todos, removed } = removeTodos(list, (t) => t.id === 1);
    const once = restoreTodos(todos, removed);
    expect(ids(restoreTodos(once, removed))).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("reports nothing removed when nothing matched", () => {
    expect(removeTodos(list, () => false).removed).toEqual([]);
  });
});

describe("launch at login", () => {
  let home;
  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), "fd-autostart-"));
  });
  afterEach(() => fs.rmSync(home, { recursive: true, force: true }));

  const linux = (env = {}, isPackaged = true) =>
    createAutostart({
      app: { isPackaged, getLoginItemSettings: () => ({ openAtLogin: false }), setLoginItemSettings() {} },
      platform: "linux",
      env,
      fs,
      homedir: home,
    });

  it("writes and removes a freedesktop autostart entry on Linux", () => {
    const auto = linux({ APPIMAGE: "/home/dev/Apps/FocusDock 0.1.9.AppImage" });
    expect(auto.isEnabled()).toBe(false);
    expect(auto.setEnabled(true)).toBe(true);
    const entry = fs.readFileSync(path.join(home, ".config/autostart/focusdock.desktop"), "utf8");
    expect(entry).toContain('Exec="/home/dev/Apps/FocusDock 0.1.9.AppImage"');
    expect(entry).toContain("Type=Application");
    expect(auto.setEnabled(false)).toBe(false);
    expect(fs.existsSync(auto.entryPath)).toBe(false);
  });

  it("follows XDG_CONFIG_HOME and treats a hidden entry as off", () => {
    const auto = linux({ XDG_CONFIG_HOME: path.join(home, "cfg") });
    auto.setEnabled(true);
    expect(auto.entryPath).toBe(path.join(home, "cfg/autostart/focusdock.desktop"));
    fs.appendFileSync(auto.entryPath, "Hidden=true\n");
    expect(auto.isEnabled()).toBe(false);
  });

  it("does nothing in development, so Electron itself never starts at login", () => {
    const auto = linux({}, false);
    expect(auto.supported).toBe(false);
    expect(auto.setEnabled(true)).toBe(false);
    expect(fs.existsSync(auto.entryPath)).toBe(false);
  });

  it("uses Electron's login item on Windows", () => {
    const calls = [];
    let on = false;
    const auto = createAutostart({
      app: {
        isPackaged: true,
        getLoginItemSettings: () => ({ openAtLogin: on }),
        setLoginItemSettings: (s) => { calls.push(s); on = s.openAtLogin; },
      },
      platform: "win32",
      env: {},
      fs,
      homedir: home,
    });
    expect(auto.setEnabled(true)).toBe(true);
    expect(calls).toEqual([{ openAtLogin: true }]);
  });

  it("quotes paths with spaces and shell characters", () => {
    expect(quoteExec('/opt/Focus "Dock"/$app')).toBe('"/opt/Focus \\"Dock\\"/\\$app"');
  });
});
