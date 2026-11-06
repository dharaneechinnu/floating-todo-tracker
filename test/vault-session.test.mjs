import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sessionModule from "../electron/vault/session.js";

const { createVaultSession } = sessionModule;
const FAST_KDF = { alg: "scrypt", N: 1024, r: 8, p: 1 };
const PASS = "correct horse lamp river";

// Fake timers and clipboard so locking and clearing can be driven by hand.
function harness(dir) {
  const timers = new Map();
  let nextId = 1;
  let clock = 1_000_000;
  const clip = { text: "", writeText(t) { this.text = t; }, readText() { return this.text; } };
  const locks = [];
  const session = createVaultSession({
    filePath: path.join(dir, "vault.json"),
    clipboard: clip,
    kdf: FAST_KDF,
    now: () => clock,
    setTimer: (fn, ms) => { const id = nextId++; timers.set(id, { fn, at: clock + ms }); return id; },
    clearTimer: (id) => timers.delete(id),
    onLock: (reason) => locks.push(reason),
  });
  const advance = (ms) => {
    clock += ms;
    for (const [id, t] of [...timers]) if (t.at <= clock) { timers.delete(id); t.fn(); }
  };
  return { session, clip, locks, advance, dir };
}

let dir;
let h;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "fd-session-"));
  h = harness(dir);
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("vault session", () => {
  it("starts with no vault, then creates one and shows the recovery code once", async () => {
    expect(h.session.status().state).toBe("none");
    const { recoveryCode } = await h.session.create(PASS);
    expect(recoveryCode).toMatch(/^([A-Z2-9]{4}-){7}[A-Z2-9]{4}$/);
    expect(h.session.status().state).toBe("unlocked");
    const onDisk = fs.readFileSync(path.join(dir, "vault.json"), "utf8");
    expect(onDisk).not.toContain(recoveryCode);
    expect(onDisk).not.toContain(PASS);
  });

  it("refuses a short passphrase and a second vault", async () => {
    await expect(h.session.create("short")).rejects.toMatchObject({ code: "weak" });
    await h.session.create(PASS);
    await expect(h.session.create(PASS)).rejects.toMatchObject({ code: "exists" });
  });

  it("stores sections and notes encrypted, and lists titles only", async () => {
    await h.session.create(PASS);
    const work = h.session.add({ kind: "section", content: { title: "Work", color: "#5b8cff" } });
    const gh = h.session.add({ kind: "login", parentId: work, content: { title: "GitHub", username: "dharan", password: "gH7#pQ2!" } });
    expect(h.session.list().map((i) => i.title).sort()).toEqual(["GitHub", "Work"]);
    expect(JSON.stringify(h.session.list())).not.toContain("gH7#pQ2!");
    expect(h.session.open(gh).content.password).toBe("gH7#pQ2!");
    expect(fs.readFileSync(path.join(dir, "vault.json"), "utf8")).not.toContain("GitHub");

    const updated = h.session.update(gh, { password: "rotated" });
    expect(updated.content).toMatchObject({ username: "dharan", password: "rotated" });
    h.session.remove(work);
    expect(h.session.list()).toEqual([]);
  });

  it("locks, refuses access while locked, and unlocks with the passphrase", async () => {
    await h.session.create(PASS);
    h.session.lock();
    expect(h.locks).toEqual(["manual"]);
    expect(() => h.session.list()).toThrow(/locked/);
    await expect(h.session.unlock("wrong passphrase")).rejects.toMatchObject({ code: "wrong" });
    expect((await h.session.unlock(PASS)).state).toBe("unlocked");
  });

  it("locks itself after 5 idle minutes, and activity resets the clock", async () => {
    await h.session.create(PASS);
    h.advance(4 * 60_000);
    h.session.list();
    h.advance(4 * 60_000);
    expect(h.session.status().state).toBe("unlocked");
    h.advance(60_000 + 1);
    expect(h.session.status().state).toBe("locked");
    expect(h.locks).toEqual(["idle"]);
  });

  it("makes you wait after repeated wrong passphrases, even across a restart", async () => {
    await h.session.create(PASS);
    h.session.lock();
    for (let i = 0; i < 5; i += 1) await h.session.unlock("nope").catch(() => {});
    await expect(h.session.unlock(PASS)).rejects.toMatchObject({ code: "wait" });

    const restarted = harness(dir);
    expect(restarted.session.status()).toMatchObject({ state: "locked", waitMs: 2000 });
    await expect(restarted.session.unlock(PASS)).rejects.toMatchObject({ code: "wait" });
    restarted.advance(2000);
    expect((await restarted.session.unlock(PASS)).state).toBe("unlocked");
    expect(JSON.parse(fs.readFileSync(path.join(dir, "vault.json"), "utf8")).failedUnlocks).toBe(0);
  });

  it("recovers with the recovery code and sets a new passphrase", async () => {
    const { recoveryCode } = await h.session.create(PASS);
    h.session.add({ kind: "section", content: { title: "Kept" } });
    h.session.lock();
    await expect(h.session.recover("AAAA-BBBB", "a brand new passphrase")).rejects.toMatchObject({ code: "wrong" });
    await h.session.recover(recoveryCode.toLowerCase(), "a brand new passphrase");
    expect(h.session.list().map((i) => i.title)).toEqual(["Kept"]);
    h.session.lock();
    await expect(h.session.unlock(PASS)).rejects.toMatchObject({ code: "wrong" });
    expect((await h.session.unlock("a brand new passphrase")).state).toBe("unlocked");
  });

  it("copies a secret and clears the clipboard after 30 seconds", async () => {
    await h.session.create(PASS);
    const s = h.session.add({ kind: "section", content: { title: "Work" } });
    const id = h.session.add({ kind: "login", parentId: s, content: { title: "x", password: "p@ss" } });
    expect(h.session.copy(id, "password")).toEqual({ clearsInMs: 30_000 });
    expect(h.clip.text).toBe("p@ss");
    h.advance(30_000);
    expect(h.clip.text).toBe("");
  });

  it("leaves the clipboard alone if you copied something else meanwhile", async () => {
    await h.session.create(PASS);
    const s = h.session.add({ kind: "section", content: { title: "Work" } });
    const id = h.session.add({ kind: "login", parentId: s, content: { title: "x", password: "p@ss" } });
    h.session.copy(id, "password");
    h.clip.writeText("something the user copied");
    h.advance(30_000);
    expect(h.clip.text).toBe("something the user copied");
  });

  it("only copies username, password or URL", async () => {
    await h.session.create(PASS);
    const s = h.session.add({ kind: "section", content: { title: "Work" } });
    const id = h.session.add({ kind: "login", parentId: s, content: { title: "x", body: "notes" } });
    expect(() => h.session.copy(id, "body")).toThrow(/can't be copied/);
    expect(() => h.session.copy(id, "password")).toThrow(/nothing to copy/);
  });

  it("refuses to touch a vault from a newer version", async () => {
    fs.writeFileSync(path.join(dir, "vault.json"), JSON.stringify({ format: 99 }));
    const newer = harness(dir);
    expect(newer.session.status().state).toBe("newer");
    await expect(newer.session.create(PASS)).rejects.toMatchObject({ code: "newer" });
    expect(JSON.parse(fs.readFileSync(path.join(dir, "vault.json"), "utf8"))).toEqual({ format: 99 });
  });
});
