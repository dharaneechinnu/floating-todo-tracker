import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vaultCrypto from "../electron/vault/crypto.js";
import vaultFile from "../electron/vault/file.js";
import items from "../electron/vault/items.js";

// Cheap scrypt settings so the suite stays fast; one test uses the real ones.
const FAST_KDF = { alg: "scrypt", N: 1024, r: 8, p: 1 };
const PASS = "correct horse lamp river";

describe("vault crypto", () => {
  let made;
  beforeAll(async () => { made = await vaultCrypto.createVault(PASS, FAST_KDF); });

  it("unlocks with the right passphrase and refuses a wrong one", async () => {
    const key = await vaultCrypto.unlockVault(made.header, PASS);
    expect(key.equals(made.vaultKey)).toBe(true);
    await expect(vaultCrypto.unlockVault(made.header, "wrong passphrase")).rejects.toBeInstanceOf(vaultCrypto.WrongSecretError);
  });

  it("treats differently composed but identical characters as the same passphrase", async () => {
    const composed = await vaultCrypto.createVault("café river", FAST_KDF);
    const key = await vaultCrypto.unlockVault(composed.header, "café river");
    expect(key.equals(composed.vaultKey)).toBe(true);
  });

  it("unlocks with the recovery code, in any case or spacing", () => {
    expect(made.recoveryCode).toMatch(/^([A-Z2-9]{4}-){7}[A-Z2-9]{4}$/);
    const messy = made.recoveryCode.toLowerCase().replace(/-/g, " ");
    expect(vaultCrypto.unlockWithRecoveryCode(made.header, messy).equals(made.vaultKey)).toBe(true);
    expect(() => vaultCrypto.unlockWithRecoveryCode(made.header, "AAAA-AAAA")).toThrow(vaultCrypto.WrongSecretError);
  });

  it("changes the passphrase without changing the vault key", async () => {
    const header = await vaultCrypto.rewrapWithPassphrase(made.header, made.vaultKey, "a new passphrase here");
    expect((await vaultCrypto.unlockVault(header, "a new passphrase here")).equals(made.vaultKey)).toBe(true);
    await expect(vaultCrypto.unlockVault(header, PASS)).rejects.toThrow();
    expect(vaultCrypto.unlockWithRecoveryCode(header, made.recoveryCode).equals(made.vaultKey)).toBe(true);
  });

  it("never stores the passphrase, the key or the recovery code in the header", () => {
    const text = JSON.stringify(made.header);
    expect(text).not.toContain(PASS);
    expect(text).not.toContain(made.vaultKey.toString("base64"));
    expect(text).not.toContain(made.recoveryCode);
  });

  it("detects tampering and ciphertext moved between items", () => {
    const blob = vaultCrypto.sealJson(made.vaultKey, { password: "hunter2" }, "item:a:login");
    expect(vaultCrypto.openJson(made.vaultKey, blob, "item:a:login")).toEqual({ password: "hunter2" });
    expect(() => vaultCrypto.openJson(made.vaultKey, blob, "item:b:login")).toThrow();
    const flipped = { ...blob, ct: Buffer.from(Buffer.from(blob.ct, "base64").map((b, i) => (i === 0 ? b ^ 1 : b))).toString("base64") };
    expect(() => vaultCrypto.openJson(made.vaultKey, flipped, "item:a:login")).toThrow();
  });

  it("uses a fresh IV every time", () => {
    const a = vaultCrypto.sealJson(made.vaultKey, { x: 1 });
    const b = vaultCrypto.sealJson(made.vaultKey, { x: 1 });
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
  });

  it("works with the real scrypt settings", async () => {
    const real = await vaultCrypto.createVault(PASS);
    expect(real.header.kdf).toMatchObject({ alg: "scrypt", N: 131072, r: 8, p: 1 });
    expect((await vaultCrypto.unlockVault(real.header, PASS)).equals(real.vaultKey)).toBe(true);
  }, 20_000);
});

describe("vault file", () => {
  let dir;
  let file;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "fd-vault-"));
    file = path.join(dir, "vault.json");
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("round-trips and keeps the last 3 versions", () => {
    for (let n = 1; n <= 5; n += 1) vaultFile.writeVault(file, { format: 1, n, items: [] });
    expect(vaultFile.readVault(file).n).toBe(5);
    expect(JSON.parse(fs.readFileSync(`${file}.1`, "utf8")).n).toBe(4);
    expect(JSON.parse(fs.readFileSync(`${file}.3`, "utf8")).n).toBe(2);
    expect(fs.existsSync(`${file}.4`)).toBe(false);
    expect(fs.existsSync(`${file}.tmp`)).toBe(false);
  });

  it("refuses a vault from a newer version", () => {
    fs.writeFileSync(file, JSON.stringify({ format: 99 }));
    expect(() => vaultFile.readVault(file)).toThrow(vaultFile.NewerVaultError);
  });

  it("returns null when there is no vault yet", () => {
    expect(vaultFile.readVault(file)).toBeNull();
  });

  it("makes people wait longer after repeated wrong passphrases, up to a minute", () => {
    expect([0, 4, 5, 6, 7, 20].map(vaultFile.unlockWaitMs)).toEqual([0, 0, 2000, 4000, 8000, 60000]);
    let data = { failedUnlocks: 4, lockedUntil: 0 };
    data = vaultFile.recordFailedUnlock(data, 1000);
    expect(data).toEqual({ failedUnlocks: 5, lockedUntil: 3000 });
    expect(vaultFile.recordSuccessfulUnlock(data)).toEqual({ failedUnlocks: 0, lockedUntil: 0 });
  });
});

describe("vault items and sync merge", () => {
  let key;
  let vault;
  let sectionId;

  beforeAll(async () => {
    const made = await vaultCrypto.createVault(PASS, FAST_KDF);
    key = made.vaultKey;
    vault = vaultFile.emptyVault(made.header);
  });

  it("creates sections and notes, and lists titles without secrets", () => {
    const s = items.createItem(vault, key, { kind: "section", content: { title: "Work", color: "#5b8cff" } });
    sectionId = s.item.id;
    const n = items.createItem(s.vault, key, {
      kind: "login",
      parentId: sectionId,
      content: { title: "GitHub", username: "dharan", password: "gH7#pQ2!", body: "2FA in app" },
    });
    vault = n.vault;
    const listed = items.listItems(vault, key);
    expect(listed.find((i) => i.kind === "section")).toMatchObject({ title: "Work", noteCount: 1 });
    expect(JSON.stringify(listed)).not.toContain("gH7#pQ2!");
    expect(JSON.stringify(vault)).not.toContain("GitHub");
  });

  it("needs a section for a note", () => {
    expect(() => items.createItem(vault, key, { kind: "note", parentId: null, content: { title: "x" } })).toThrow(/section/);
  });

  it("bumps rev on edit and keeps fields it didn't touch", () => {
    const login = vault.items.find((i) => i.kind === "login");
    const withExtra = items.updateItem(vault, key, login.id, { futureField: "kept" });
    const edited = items.updateItem(withExtra, key, login.id, { password: "new-pass" });
    const after = edited.items.find((i) => i.id === login.id);
    expect(after.rev).toBe(login.rev + 2);
    expect(items.decrypt(key, after)).toMatchObject({ username: "dharan", password: "new-pass", futureField: "kept" });
    vault = edited;
  });

  it("deletes a section and its notes as tombstones", () => {
    const gone = items.deleteItem(vault, key, sectionId);
    expect(gone.items.every((i) => i.deleted && i.dirty)).toBe(true);
    expect(items.listItems(gone, key)).toEqual([]);
    expect(items.pendingPush(gone)).toHaveLength(2);
  });

  it("marks only the pushed revision as clean", () => {
    const pending = items.pendingPush(vault);
    const accepted = pending.map(({ id, rev }) => ({ id, rev }));
    const pushed = items.markPushed(vault, accepted);
    expect(items.pendingPush(pushed)).toEqual([]);

    const login = pushed.items.find((i) => i.kind === "login");
    const editedAgain = items.updateItem(pushed, key, login.id, { body: "edited after push" });
    const stillDirty = items.markPushed(editedAgain, accepted);
    expect(items.pendingPush(stillDirty).map((i) => i.id)).toEqual([login.id]);
    vault = items.markPushed(stillDirty, items.pendingPush(stillDirty).map(({ id, rev }) => ({ id, rev })));
  });

  it("takes a newer remote copy when nothing changed here", () => {
    const login = vault.items.find((i) => i.kind === "login");
    const remoteData = items.updateItem(vault, key, login.id, { title: "GitHub (work)" }).items.find((i) => i.id === login.id);
    const remote = { ...remoteData, rev: login.rev + 1, updatedAt: new Date().toISOString() };
    const { vault: merged, conflicts } = items.applyRemote(vault, key, [remote]);
    expect(conflicts).toBe(0);
    expect(items.decrypt(key, merged.items.find((i) => i.id === login.id)).title).toBe("GitHub (work)");
    vault = merged;
  });

  it("ignores an older or equal remote copy", () => {
    const login = vault.items.find((i) => i.kind === "login");
    const { vault: merged } = items.applyRemote(vault, key, [{ ...login, data: { ...login.data }, rev: login.rev, updatedAt: "2020-01-01T00:00:00Z" }]);
    expect(merged.items.find((i) => i.id === login.id)).toEqual(login);
  });

  it("keeps a conflict copy when both computers edited the same note", () => {
    const login = vault.items.find((i) => i.kind === "login");
    const localEdit = items.updateItem(vault, key, login.id, { password: "edited-here" });
    const remoteEdit = items.updateItem(vault, key, login.id, { password: "edited-there" }).items.find((i) => i.id === login.id);
    const remote = { ...remoteEdit, rev: remoteEdit.rev + 5, updatedAt: new Date().toISOString() };

    const { vault: merged, conflicts } = items.applyRemote(localEdit, key, [remote]);
    expect(conflicts).toBe(1);
    const all = merged.items.filter((i) => i.kind === "login").map((i) => items.decrypt(key, i));
    expect(all.map((c) => c.password).sort()).toEqual(["edited-here", "edited-there"]);
    expect(all.find((c) => c.password === "edited-here").title).toMatch(/\(conflict copy\)$/);
    expect(items.pendingPush(merged)).toHaveLength(1);
  });

  it("treats an equal rev with local edits as a conflict, not as the same copy", () => {
    const login = vault.items.find((i) => i.kind === "login" && !i.dirty);
    const here = items.updateItem(vault, key, login.id, { password: "here" });
    const thereItem = items.updateItem(vault, key, login.id, { password: "there" }).items.find((i) => i.id === login.id);
    expect(thereItem.rev).toBe(here.items.find((i) => i.id === login.id).rev);

    const { vault: merged, conflicts } = items.applyRemote(here, key, [{ ...thereItem, updatedAt: new Date().toISOString() }]);
    expect(conflicts).toBe(1);
    const passwords = merged.items.filter((i) => i.kind === "login" && !i.deleted).map((i) => items.decrypt(key, i).password);
    expect(passwords).toEqual(expect.arrayContaining(["here", "there"]));
  });

  it("keeps a newer local edit when the server echoes back an older rev", () => {
    const login = vault.items.find((i) => i.kind === "login" && !i.dirty);
    const echo = { ...login, updatedAt: new Date().toISOString() };
    const edited = items.updateItem(vault, key, login.id, { body: "typed after the push" });
    const { vault: merged, conflicts } = items.applyRemote(edited, key, [echo]);
    expect(conflicts).toBe(0);
    expect(items.decrypt(key, merged.items.find((i) => i.id === login.id)).body).toBe("typed after the push");
  });

  it("adds items that only exist on the server", () => {
    const other = items.createItem(vault, key, { kind: "section", content: { title: "Banking" } }).item;
    const { vault: merged } = items.applyRemote(vault, key, [{ ...other, updatedAt: new Date().toISOString() }]);
    expect(items.listItems(merged, key).map((i) => i.title)).toContain("Banking");
    expect(merged.items.find((i) => i.id === other.id).dirty).toBe(false);
  });
});
