import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sessionModule from "../electron/vault/session.js";
import backupModule from "../electron/vault/backup.js";

const { createVaultSession } = sessionModule;
const { readBackup, backupFileName } = backupModule;
const FAST_KDF = { alg: "scrypt", N: 1024, r: 8, p: 1 };
const PASS = "correct horse lamp river";

let root;
let n;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "fd-backup-"));
  n = 0;
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

function vault() {
  n += 1;
  const dir = path.join(root, `v${n}`);
  fs.mkdirSync(dir);
  return createVaultSession({
    filePath: path.join(dir, "vault.json"),
    clipboard: { writeText() {}, readText: () => "" },
    kdf: FAST_KDF,
    appVersion: "0.4.0",
  });
}

async function filled() {
  const session = vault();
  const { recoveryCode } = await session.create(PASS);
  const work = session.add({ kind: "section", content: { title: "Work" } });
  const github = session.add({ kind: "login", parentId: work, content: { title: "GitHub", password: "gH7#pQ2!vLm9xR" } });
  const note = session.add({ kind: "note", parentId: work, content: { title: "Door code", body: "4821" } });
  return { session, recoveryCode, work, github, note };
}

// Through a real file, the way the app does it.
const roundTrip = (backup) => readBackup(JSON.stringify(backup));
const titles = (session) => session.list().map((i) => i.title).sort();

describe("changing the passphrase", () => {
  it("needs the current passphrase, and the old one stops working", async () => {
    const { session, github } = await filled();
    await expect(session.changePassphrase("not it at all", "a brand new passphrase")).rejects.toMatchObject({ code: "wrong" });
    await expect(session.changePassphrase(PASS, "short")).rejects.toMatchObject({ code: "weak" });
    await expect(session.changePassphrase(PASS, PASS)).rejects.toMatchObject({ code: "same" });

    await session.changePassphrase(PASS, "a brand new passphrase");
    expect(session.status().state).toBe("unlocked"); // stays open
    session.lock();
    await expect(session.unlock(PASS)).rejects.toMatchObject({ code: "wrong" });
    await session.unlock("a brand new passphrase");
    expect(session.open(github).content.password).toBe("gH7#pQ2!vLm9xR");
  });

  it("keeps the recovery code working", async () => {
    const { session, recoveryCode } = await filled();
    await session.changePassphrase(PASS, "a brand new passphrase");
    session.lock();
    await session.recover(recoveryCode, "yet another passphrase");
    expect(titles(session)).toEqual(["Door code", "GitHub", "Work"]);
  });

  it("is refused while the vault is locked", async () => {
    const { session } = await filled();
    session.lock();
    await expect(session.changePassphrase(PASS, "a brand new passphrase")).rejects.toMatchObject({ code: "locked" });
  });
});

describe("the backup file", () => {
  it("holds every note, and nothing in it is readable", async () => {
    const { session, github } = await filled();
    session.remove(github);
    const backup = session.exportBackup();
    expect(backup).toMatchObject({ app: "FocusDock", kind: "vault-backup", backupFormat: 1, appVersion: "0.4.0", count: 2 });
    const text = JSON.stringify(backup);
    for (const secret of ["Work", "Door code", "4821", PASS]) expect(text).not.toContain(secret);
    expect(text).not.toContain("failedUnlocks");
    expect(backupFileName(new Date(2026, 10, 10))).toBe("FocusDock vault backup 2026-11-10.fdvault");
  });

  it("brings back what was deleted since, without asking for a passphrase", async () => {
    const { session, work, github } = await filled();
    const backup = roundTrip(session.exportBackup());
    session.remove(github);
    expect(session.inspectBackup(backup)).toMatchObject({ count: 3, needsSecret: false });
    expect(await session.importBackup(backup)).toEqual({ restored: 1, skipped: 2 });
    expect(session.open(github).content.password).toBe("gH7#pQ2!vLm9xR");

    // a whole deleted section comes back with its notes
    session.remove(work);
    expect(titles(session)).toEqual([]);
    expect(await session.importBackup(backup)).toEqual({ restored: 3, skipped: 0 });
    expect(titles(session)).toEqual(["Door code", "GitHub", "Work"]);
  });

  it("never replaces a note that is still there, and restoring twice changes nothing", async () => {
    const { session, github } = await filled();
    const backup = roundTrip(session.exportBackup());
    session.update(github, { password: "newer than the backup" });
    expect(await session.importBackup(backup)).toEqual({ restored: 0, skipped: 3 });
    expect(await session.importBackup(backup)).toEqual({ restored: 0, skipped: 3 });
    expect(session.open(github).content.password).toBe("newer than the backup");
  });

  it("restores into a different vault with the backup's passphrase or recovery code", async () => {
    const old = await filled();
    const backup = roundTrip(old.session.exportBackup());

    const fresh = vault();
    await fresh.create("the new vault's passphrase");
    expect(fresh.inspectBackup(backup)).toMatchObject({ count: 3, needsSecret: true });
    await expect(fresh.importBackup(backup, "wrong secret here")).rejects.toMatchObject({ code: "wrong" });
    expect(await fresh.importBackup(backup, PASS)).toEqual({ restored: 3, skipped: 0 });
    expect(titles(fresh)).toEqual(["Door code", "GitHub", "Work"]);
    const login = fresh.list().find((i) => i.kind === "login");
    expect(fresh.open(login.id).content.password).toBe("gH7#pQ2!vLm9xR");
    // new ids, so the copies can sync without colliding with the old vault's
    expect(login.id).not.toBe(old.github);

    const another = vault();
    await another.create("the new vault's passphrase");
    expect(await another.importBackup(backup, old.recoveryCode)).toEqual({ restored: 3, skipped: 0 });
  });

  it("still opens with the passphrase it was made under after the vault's passphrase changes", async () => {
    const { session, github } = await filled();
    const backup = roundTrip(session.exportBackup());
    await session.changePassphrase(PASS, "a brand new passphrase");
    session.remove(github);
    expect(await session.importBackup(backup)).toEqual({ restored: 1, skipped: 2 });
  });

  it("refuses files that aren't backups, damaged ones, and ones from a newer version", async () => {
    expect(() => readBackup("not json")).toThrow(/isn't a FocusDock vault backup/);
    expect(() => readBackup(JSON.stringify({ app: "FocusDock", kind: "tasks", exportFormat: 1 }))).toThrow(/isn't a FocusDock vault backup/);
    const { session } = await filled();
    const backup = session.exportBackup();
    expect(() => readBackup(JSON.stringify({ ...backup, backupFormat: 2 }))).toThrow(/newer version/);
    expect(() => readBackup(JSON.stringify({ ...backup, items: [{ id: "x" }] }))).toThrow(/damaged/);
    const tampered = roundTrip({ ...backup, items: backup.items.map((i) => ({ ...i, data: { ...i.data, ct: i.data.ct.replace(/^./, (c) => (c === "A" ? "B" : "A")) } })) });
    expect(await session.importBackup(tampered, PASS)).toMatchObject({ restored: 0 });
  });
});
