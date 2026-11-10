import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sessionModule from "../electron/vault/session.js";
import syncModule from "../electron/vault/sync.js";
import clientModule from "../electron/sync/client.js";
import { createFakeServer } from "./helpers/fakeServer.mjs";

const { createVaultSession } = sessionModule;
const { createVaultSync } = syncModule;
const { createSyncClient, normaliseServerUrl } = clientModule;

const FAST_KDF = { alg: "scrypt", N: 1024, r: 8, p: 1 };
const PASS = "correct horse lamp river";
const EMAIL = "dharan@example.com";
const PASSWORD = "account password";
const SERVER = "https://sync.example.com";

let root;
let server;
let count;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "fd-sync-"));
  server = createFakeServer();
  count = 0;
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

// One "computer": its own vault folder, its own saved sign-in, one server.
function computer({ appVersion = "0.4.0" } = {}) {
  count += 1;
  const dir = path.join(root, `pc${count}`);
  fs.mkdirSync(dir);
  const clip = { text: "", writeText(t) { this.text = t; }, readText() { return this.text; } };
  let savedTokens = null;
  const changes = [];
  const session = createVaultSession({
    filePath: path.join(dir, "vault.json"),
    clipboard: clip,
    kdf: FAST_KDF,
    onChange: () => changes.push(1),
  });
  const client = createSyncClient({
    fetchImpl: server.fetchImpl,
    appVersion,
    tokenStore: { load: () => savedTokens, save: (t) => { savedTokens = t; } },
  });
  const sync = createVaultSync({ session, client });
  const titles = () => session.list().map((i) => i.title).sort();
  return { dir, session, client, sync, titles, changes, tokens: () => savedTokens };
}

const signIn = (pc, create = false) => pc.client.signIn({ server: SERVER, email: EMAIL, password: PASSWORD, create });

async function laptopWithVault() {
  const laptop = computer();
  await laptop.session.create(PASS);
  const work = laptop.session.add({ kind: "section", content: { title: "Work" } });
  const github = laptop.session.add({
    kind: "login",
    parentId: work,
    content: { title: "GitHub", username: "dharan", password: "gH7#pQ2!vLm9xR" },
  });
  await signIn(laptop, true);
  await laptop.sync.link();
  return { laptop, work, github };
}

async function secondComputer() {
  const desktop = computer();
  await signIn(desktop);
  await desktop.sync.join(PASS);
  return desktop;
}

describe("server address", () => {
  it("accepts https and a server on this computer, and refuses plain http elsewhere", () => {
    expect(normaliseServerUrl("sync.example.com/")).toBe("https://sync.example.com");
    expect(normaliseServerUrl("http://localhost:8080")).toBe("http://localhost:8080");
    expect(() => normaliseServerUrl("http://sync.example.com")).toThrow(/https/);
    expect(() => normaliseServerUrl("https://user:pw@sync.example.com")).toThrow();
    expect(() => normaliseServerUrl("")).toThrow(/address/);
  });
});

describe("the account on this computer", () => {
  it("creates an account, remembers it, and signs out", async () => {
    const pc = computer();
    expect(pc.client.account()).toBeNull();
    await signIn(pc, true);
    expect(pc.client.account().email).toBe(EMAIL);
    expect(pc.tokens().refreshToken).toMatch(/^refresh-/);
    await pc.client.signOut();
    expect(pc.client.account()).toBeNull();
    expect(pc.tokens().refreshToken).toBeUndefined();
  });

  it("reports a wrong password with the server's own words", async () => {
    const pc = computer();
    await signIn(pc, true);
    await pc.client.signOut();
    await expect(pc.client.signIn({ server: SERVER, email: EMAIL, password: "not the password" })).rejects.toMatchObject({
      code: "bad_credentials",
      message: "Email or password is incorrect.",
    });
  });

  it("renews an expired access token without the user noticing", async () => {
    const { laptop } = await laptopWithVault();
    const before = laptop.tokens().refreshToken;
    server.expireAccessTokens();
    await laptop.sync.syncNow();
    expect(laptop.tokens().refreshToken).not.toBe(before);
    expect(laptop.sync.status().error).toBeNull();
  });

  it("signs out cleanly when the session was ended elsewhere, and keeps the vault usable", async () => {
    const { laptop } = await laptopWithVault();
    server.revokeSessions();
    await expect(laptop.sync.syncNow()).rejects.toMatchObject({ code: "signed_out" });
    expect(laptop.client.account()).toBeNull();
    expect(laptop.titles()).toEqual(["GitHub", "Work"]);
  });

  it("tells an outdated app to update instead of syncing", async () => {
    server = createFakeServer({ minClient: "0.5.0" });
    const pc = computer({ appVersion: "0.4.0" });
    await expect(signIn(pc, true)).rejects.toMatchObject({ code: "update_required" });
  });

  it("deletes the account from the server and leaves the local vault alone", async () => {
    const { laptop } = await laptopWithVault();
    await expect(laptop.client.deleteAccount("wrong")).rejects.toMatchObject({ code: "bad_credentials" });
    await laptop.client.deleteAccount(PASSWORD);
    expect(server.hasUser(EMAIL)).toBe(false);
    expect(laptop.client.account()).toBeNull();
    expect(laptop.titles()).toEqual(["GitHub", "Work"]);
  });
});

describe("two computers, one vault", () => {
  it("uploads a local vault to a new account, and nothing readable reaches the server", async () => {
    const { laptop } = await laptopWithVault();
    expect(laptop.sync.status()).toMatchObject({ linked: true, pending: 0, error: null });
    expect(laptop.sync.status().lastSyncAt).toBeGreaterThan(0);
    const everything = server.stored() + JSON.stringify(server.log);
    for (const secret of ["GitHub", "gH7#pQ2!vLm9xR", PASS]) expect(everything).not.toContain(secret);
  });

  it("brings the account's vault to a second computer with the vault passphrase", async () => {
    await laptopWithVault();
    const desktop = computer();
    await signIn(desktop);
    expect(await desktop.sync.remote()).toEqual({ hasVault: true, sameVault: false });
    await expect(desktop.sync.join("not the passphrase")).rejects.toMatchObject({ code: "wrong" });
    expect(desktop.session.status().state).toBe("none");

    await desktop.sync.join(PASS);
    expect(desktop.titles()).toEqual(["GitHub", "Work"]);
    const login = desktop.session.list().find((i) => i.kind === "login");
    expect(desktop.session.open(login.id).content.password).toBe("gH7#pQ2!vLm9xR");
    // and it opens offline afterwards, with the same passphrase
    desktop.session.lock();
    expect((await desktop.session.unlock(PASS)).state).toBe("unlocked");
  });

  it("carries an edit and a delete from one computer to the other", async () => {
    const { laptop, work, github } = await laptopWithVault();
    const desktop = await secondComputer();

    laptop.session.update(github, { password: "rotated-2026-11" });
    await laptop.sync.syncNow();
    const pulled = await desktop.sync.syncNow();
    expect(pulled.pulled).toBeGreaterThan(0);
    expect(desktop.session.open(github).content.password).toBe("rotated-2026-11");

    desktop.session.remove(work);
    await desktop.sync.syncNow();
    await laptop.sync.syncNow();
    expect(laptop.titles()).toEqual([]);
  });

  it("keeps both versions when the same note was edited on both computers", async () => {
    const { laptop, github } = await laptopWithVault();
    const desktop = await secondComputer();

    laptop.session.update(github, { password: "laptop-version" });
    desktop.session.update(github, { password: "desktop-version" });
    await laptop.sync.syncNow(); // the laptop reaches the server first
    const second = await desktop.sync.syncNow();
    expect(second.conflictCopies).toBe(1);
    expect(desktop.sync.status()).toMatchObject({ pending: 0, conflictCopies: 1 });
    await laptop.sync.syncNow();

    for (const pc of [laptop, desktop]) {
      const logins = pc.session.list().filter((i) => i.kind === "login");
      expect(logins.map((i) => i.title).sort()).toEqual(["GitHub", "GitHub (conflict copy)"]);
      expect(logins.map((i) => pc.session.open(i.id).content.password).sort()).toEqual(["desktop-version", "laptop-version"]);
    }
  });

  it("works offline and catches up afterwards", async () => {
    const { laptop, work } = await laptopWithVault();
    const desktop = await secondComputer();

    server.setOffline(true);
    laptop.session.add({ kind: "note", parentId: work, content: { title: "Written on a plane" } });
    await expect(laptop.sync.syncNow()).rejects.toMatchObject({ code: "offline" });
    expect(laptop.sync.status()).toMatchObject({ pending: 1, error: { code: "offline" } });
    expect(await laptop.sync.syncQuietly()).toBeNull(); // background sync never throws

    server.setOffline(false);
    await laptop.sync.syncNow();
    expect(laptop.sync.status()).toMatchObject({ pending: 0, error: null });
    await desktop.sync.syncNow();
    expect(desktop.titles()).toContain("Written on a plane");
  });

  it("a passphrase change on one computer reaches the other, and the recovery code still works", async () => {
    const laptop = computer();
    const { recoveryCode } = await laptop.session.create(PASS);
    laptop.session.add({ kind: "section", content: { title: "Work" } });
    await signIn(laptop, true);
    await laptop.sync.link();
    const desktop = await secondComputer();

    await laptop.session.changePassphrase(PASS, "a brand new passphrase");
    expect(laptop.sync.status().pending).toBe(0);
    await laptop.sync.syncNow();
    expect((await desktop.sync.syncNow()).passphraseChanged).toBe(true);

    desktop.session.lock();
    await expect(desktop.session.unlock(PASS)).rejects.toMatchObject({ code: "wrong" });
    expect((await desktop.session.unlock("a brand new passphrase")).state).toBe("unlocked");
    desktop.session.lock();
    await desktop.session.recover(recoveryCode, "third passphrase here");
    expect(desktop.titles()).toEqual(["Work"]);
  });

  it("merges this computer's own vault into the account's vault instead of losing either", async () => {
    await laptopWithVault();
    const desktop = computer();
    await desktop.session.create("the desktop's own passphrase");
    const home = desktop.session.add({ kind: "section", content: { title: "Home" } });
    desktop.session.add({ kind: "note", parentId: home, content: { title: "Wi-Fi", body: "router password" } });
    await signIn(desktop);

    await expect(desktop.sync.link()).rejects.toMatchObject({ code: "different_vault" });
    expect(desktop.titles()).toEqual(["Home", "Wi-Fi"]); // nothing changed yet

    const joined = await desktop.sync.join(PASS);
    expect(joined.carried).toBe(2);
    expect(desktop.titles()).toEqual(["GitHub", "Home", "Wi-Fi", "Work"]);
    const wifi = desktop.session.list().find((i) => i.title === "Wi-Fi");
    expect(desktop.session.open(wifi.id).content.body).toBe("router password");
    // the old vault file is kept, and the vault now opens with the account vault's passphrase
    expect(fs.readdirSync(desktop.dir).some((f) => f.startsWith("vault.before-account."))).toBe(true);
    desktop.session.lock();
    expect((await desktop.session.unlock(PASS)).state).toBe("unlocked");

    const laptop = computer();
    await signIn(laptop);
    await laptop.sync.join(PASS);
    expect(laptop.titles()).toEqual(["GitHub", "Home", "Wi-Fi", "Work"]);
  });

  it("signing out and back in neither duplicates nor makes conflict copies", async () => {
    const { laptop } = await laptopWithVault();
    await laptop.client.signOut();
    expect(laptop.sync.status()).toMatchObject({ linked: false, account: null, needsSignIn: true });
    await signIn(laptop);
    await laptop.sync.link();
    expect(laptop.titles()).toEqual(["GitHub", "Work"]);
    expect(laptop.sync.status()).toMatchObject({ linked: true, pending: 0, conflictCopies: 0 });
  });

  it("syncing in the background does not keep the vault unlocked", async () => {
    const timers = new Map();
    let clock = 1_000_000;
    let id = 0;
    const dir = path.join(root, "idle");
    fs.mkdirSync(dir);
    const session = createVaultSession({
      filePath: path.join(dir, "vault.json"),
      clipboard: { writeText() {}, readText: () => "" },
      kdf: FAST_KDF,
      now: () => clock,
      setTimer: (fn, ms) => { id += 1; timers.set(id, { fn, at: clock + ms }); return id; },
      clearTimer: (t) => timers.delete(t),
    });
    const advance = (ms) => {
      clock += ms;
      for (const [t, timer] of [...timers]) if (timer.at <= clock) { timers.delete(t); timer.fn(); }
    };
    let saved = null;
    const client = createSyncClient({ fetchImpl: server.fetchImpl, tokenStore: { load: () => saved, save: (t) => { saved = t; } } });
    const sync = createVaultSync({ session, client, now: () => clock });
    await session.create(PASS);
    await client.signIn({ server: SERVER, email: EMAIL, password: PASSWORD, create: true });
    await sync.link();

    advance(4 * 60_000);
    await sync.syncNow();
    advance(61_000);
    expect(session.status().state).toBe("locked");
    await expect(sync.syncNow()).rejects.toMatchObject({ code: "locked" });
  });

  it("asks for a sync when the user changes something, but not when sync itself writes", async () => {
    const { laptop, work } = await laptopWithVault();
    const before = laptop.changes.length;
    await laptop.sync.syncNow();
    expect(laptop.changes.length).toBe(before);
    laptop.session.add({ kind: "note", parentId: work, content: { title: "New" } });
    expect(laptop.changes.length).toBe(before + 1);
  });
});
