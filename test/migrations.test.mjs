import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import runner from "../electron/migrations/index.js";
import STORE_MIGRATIONS from "../electron/migrations/store/index.js";
import backup from "../electron/migrations/backup.js";

const { migrate, validateMigrations } = runner;
const LATEST = STORE_MIGRATIONS.length;
const FIXTURES = path.join(import.meta.dirname, "fixtures", "store");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function fixture(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), "utf8"));
}

describe("every fixture migrates to the latest schema (R7)", () => {
  for (const name of fs.readdirSync(FIXTURES)) {
    it(name, () => {
      const result = migrate(fixture(name), STORE_MIGRATIONS);
      expect(result.status).toBe("migrated");
      expect(result.data.schemaVersion).toBe(LATEST);
      for (const todo of result.data.todos) {
        expect(todo.uid).toMatch(UUID);
        for (const key of ["done", "prNumber", "blocked", "feedback", "pomodoros", "priority", "dueDate", "createdAt"]) {
          expect(todo).toHaveProperty(key);
        }
      }
      const ids = result.data.todos.map((t) => t.id);
      expect(result.data.nextTodoId).toBeGreaterThan(Math.max(0, ...ids));
    });
  }
});

describe("store migrations", () => {
  it("backfills missing fields without overwriting existing ones", () => {
    const { data } = migrate(fixture("v0-legacy.json"), STORE_MIGRATIONS);
    const [first, , planned] = data.todos;
    expect(first).toMatchObject({ prNumber: "", priority: "", pomodoros: 0 });
    expect(planned).toMatchObject({ priority: "p1", dueDate: "2026-11-10", pomodoros: 3, blocked: true });
  });

  it("keeps fields it doesn't know about (R4)", () => {
    const { data } = migrate(fixture("v0-legacy.json"), STORE_MIGRATIONS);
    expect(data.todos[2].futureField).toBe("kept");
    expect(data.dock).toEqual({ edge: "right", along: 640 });
  });

  it("repairs a nextTodoId that would reuse an existing id", () => {
    const { data } = migrate(fixture("v0-legacy.json"), STORE_MIGRATIONS);
    expect(data.nextTodoId).toBe(6);
  });

  it("does not replace a uid that already exists", () => {
    const { data } = migrate(fixture("v1.json"), STORE_MIGRATIONS);
    expect(data.todos[1].uid).toBe("1b4e28ba-2fa1-11d2-883f-0016d3cca427");
  });

  it("treats a brand-new empty store as version 0", () => {
    const result = migrate({ todos: [], nextTodoId: 1 }, STORE_MIGRATIONS);
    expect(result).toMatchObject({ status: "migrated", from: 0, to: LATEST });
  });

  it("is a no-op on data that is already current", () => {
    const once = migrate(fixture("v0-legacy.json"), STORE_MIGRATIONS).data;
    const again = migrate(once, STORE_MIGRATIONS);
    expect(again.status).toBe("current");
    expect(again.data).toBe(once);
  });
});

describe("runner safety", () => {
  it("never mutates its input", () => {
    const input = fixture("v0-legacy.json");
    const copy = structuredClone(input);
    migrate(input, STORE_MIGRATIONS);
    expect(input).toEqual(copy);
  });

  it("reports newer data instead of touching it (R3)", () => {
    const input = { schemaVersion: LATEST + 1, todos: [{ id: 1, shape: "unknown" }] };
    const result = migrate(input, STORE_MIGRATIONS);
    expect(result.status).toBe("newer");
    expect(result.data).toBe(input);
  });

  it("returns the original data untouched when a migration throws", () => {
    const broken = [
      { version: 1, up: (d) => ({ ...d, step: 1 }) },
      { version: 2, up: () => { throw new Error("boom"); } },
    ];
    const input = { todos: [] };
    const result = migrate(input, broken);
    expect(result.status).toBe("failed");
    expect(result.error.message).toBe("boom");
    expect(result.data).toBe(input);
    expect(input).toEqual({ todos: [] });
  });

  it("rejects a migration list with gaps or duplicates", () => {
    expect(() => validateMigrations([{ version: 1, up() {} }, { version: 3, up() {} }])).toThrow(/out of order/);
    expect(() => validateMigrations([{ version: 1 }])).toThrow(/no up\(\)/);
  });
});

describe("backups (R2)", () => {
  let dir;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "fd-backup-")); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it("copies the file into backups/ with its old version in the name", () => {
    const file = path.join(dir, "config.json");
    fs.writeFileSync(file, '{"todos":[]}');
    const target = backup.backupFile(file, 1, new Date("2026-11-06T08:15:00Z"));
    expect(path.basename(target)).toBe("config.v1.2026-11-06T08-15-00-000Z.json");
    expect(fs.readFileSync(target, "utf8")).toBe('{"todos":[]}');
  });

  it(`keeps only the newest ${backup.KEEP_BACKUPS}`, () => {
    const file = path.join(dir, "config.json");
    fs.writeFileSync(file, "{}");
    for (let i = 0; i < 8; i += 1) {
      backup.backupFile(file, 1, new Date(Date.UTC(2026, 10, 1 + i)));
    }
    const left = fs.readdirSync(path.join(dir, "backups")).sort();
    expect(left).toHaveLength(backup.KEEP_BACKUPS);
    expect(left[0]).toContain("2026-11-04");
  });

  it("does nothing when there is no file yet", () => {
    expect(backup.backupFile(path.join(dir, "missing.json"), 0)).toBeNull();
  });
});
