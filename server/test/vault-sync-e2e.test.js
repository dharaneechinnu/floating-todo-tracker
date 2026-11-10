/*
 * End to end: the desktop app's real vault code (electron/vault/) syncing
 * through this server and MongoDB, as two computers on one account.
 * Proves the app's encrypted format and the API agree.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import vaultCrypto from "../../electron/vault/crypto.js";
import vaultFile from "../../electron/vault/file.js";
import items from "../../electron/vault/items.js";
import sessionModule from "../../electron/vault/session.js";
import syncModule from "../../electron/vault/sync.js";
import clientModule from "../../electron/sync/client.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { freshDatabase, testApp } from "./helpers.js";

const FAST_KDF = { alg: "scrypt", N: 1024, r: 8, p: 1 };
const PASS = "correct horse lamp river";

let ctx;
let app;
beforeAll(async () => {
  ctx = await freshDatabase();
  app = await testApp(ctx.db);
});
afterAll(async () => {
  await app.close();
  await ctx.drop();
});

async function computer(email, password = "account password") {
  let res = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password } });
  if (res.statusCode === 401) {
    res = await app.inject({ method: "POST", url: "/v1/auth/register", payload: { email, password } });
  }
  const token = res.json().accessToken;
  const call = async (method, url, payload) => {
    const r = await app.inject({ method, url, payload, headers: { authorization: `Bearer ${token}` } });
    return { status: r.statusCode, body: r.body ? r.json() : null };
  };
  return { call, vault: null, key: null, cursor: 0 };
}

async function sync(pc) {
  const pending = items.pendingPush(pc.vault);
  let conflicts = [];
  if (pending.length) {
    const push = await pc.call("POST", "/v1/sync/push", { items: pending });
    expect(push.status).toBe(200);
    pc.vault = items.markPushed(pc.vault, push.body.accepted);
    conflicts = push.body.conflicts;
  }
  const pull = await pc.call("GET", `/v1/sync/pull?since=${pc.cursor}`);
  const merged = items.applyRemote(pc.vault, pc.key, pull.body.items);
  pc.vault = merged.vault;
  pc.cursor = pull.body.cursor;
  return { conflicts, conflictCopies: merged.conflicts };
}

describe("two computers, one vault", () => {
  let laptop;
  let desktop;

  it("laptop creates the vault and uploads its key and notes", async () => {
    laptop = await computer("dharan@example.com");
    const made = await vaultCrypto.createVault(PASS, FAST_KDF);
    laptop.key = made.vaultKey;
    laptop.vault = vaultFile.emptyVault(made.header);
    expect((await laptop.call("PUT", "/v1/vault/keys", made.header)).status).toBe(201);

    const work = items.createItem(laptop.vault, laptop.key, { kind: "section", content: { title: "Work" } });
    laptop.vault = items.createItem(work.vault, laptop.key, {
      kind: "login",
      parentId: work.item.id,
      content: { title: "GitHub", username: "dharan", password: "gH7#pQ2!vLm9xR" },
    }).vault;
    await sync(laptop);
    expect(items.pendingPush(laptop.vault)).toEqual([]);

    // The database holds nothing readable.
    const raw = JSON.stringify(await ctx.db.collection("vault_items").find().toArray());
    expect(raw).not.toContain("GitHub");
    expect(raw).not.toContain("gH7#pQ2!vLm9xR");
  });

  it("desktop signs in, unlocks with the same passphrase and sees everything", async () => {
    desktop = await computer("dharan@example.com");
    const keys = await desktop.call("GET", "/v1/vault/keys");
    expect(keys.status).toBe(200);
    desktop.key = await vaultCrypto.unlockVault(keys.body, PASS);
    desktop.vault = vaultFile.emptyVault(keys.body);
    await sync(desktop);

    const listed = items.listItems(desktop.vault, desktop.key);
    expect(listed.map((i) => i.title).sort()).toEqual(["GitHub", "Work"]);
    const login = desktop.vault.items.find((i) => i.kind === "login");
    expect(items.decrypt(desktop.key, login).password).toBe("gH7#pQ2!vLm9xR");
  });

  it("a wrong passphrase on the desktop can't open the downloaded key", async () => {
    const keys = await desktop.call("GET", "/v1/vault/keys");
    await expect(vaultCrypto.unlockVault(keys.body, "not the passphrase")).rejects.toThrow();
  });

  it("an edit on one computer reaches the other", async () => {
    const login = laptop.vault.items.find((i) => i.kind === "login");
    laptop.vault = items.updateItem(laptop.vault, laptop.key, login.id, { password: "rotated-2026-11" });
    await sync(laptop);
    await sync(desktop);
    const there = desktop.vault.items.find((i) => i.id === login.id);
    expect(items.decrypt(desktop.key, there).password).toBe("rotated-2026-11");
  });

  it("editing the same note on both keeps both versions", async () => {
    const id = laptop.vault.items.find((i) => i.kind === "login").id;
    laptop.vault = items.updateItem(laptop.vault, laptop.key, id, { password: "laptop-version" });
    desktop.vault = items.updateItem(desktop.vault, desktop.key, id, { password: "desktop-version" });

    await sync(laptop); // laptop wins the race to the server
    const second = await sync(desktop);
    expect(second.conflicts).toEqual([{ id, serverRev: expect.any(Number) }]);
    expect(second.conflictCopies).toBe(1);
    await sync(desktop); // uploads the conflict copy
    await sync(laptop);

    for (const pc of [laptop, desktop]) {
      const passwords = pc.vault.items
        .filter((i) => i.kind === "login" && !i.deleted)
        .map((i) => items.decrypt(pc.key, i).password)
        .sort();
      expect(passwords).toEqual(["desktop-version", "laptop-version"]);
    }
  });

  it("a delete on one computer removes it on the other", async () => {
    const section = laptop.vault.items.find((i) => i.kind === "section");
    laptop.vault = items.deleteItem(laptop.vault, laptop.key, section.id);
    await sync(laptop);
    await sync(desktop);
    expect(items.listItems(desktop.vault, desktop.key)).toEqual([]);
  });
});

/*
 * The same journey through the app's real account and sync code
 * (electron/sync/client.js, electron/vault/sync.js, electron/vault/session.js):
 * the only thing replaced is the network, which goes straight into this
 * server instead of over HTTP.
 */
describe("the desktop app's sync engine against this server", () => {
  const EMAIL = "engine@example.com";
  const ACCOUNT_PASSWORD = "account password";
  let root;
  let laptop;
  let desktop;
  let github;

  const intoServer = async (url, { method, headers, body }) => {
    const { pathname, search } = new URL(url);
    const res = await app.inject({ method, url: pathname + search, headers, payload: body });
    return { ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, text: async () => res.body };
  };

  function pc(name) {
    const dir = path.join(root, name);
    fs.mkdirSync(dir);
    let saved = null;
    const session = sessionModule.createVaultSession({
      filePath: path.join(dir, "vault.json"),
      clipboard: { writeText() {}, readText: () => "" },
      kdf: FAST_KDF,
    });
    const client = clientModule.createSyncClient({
      fetchImpl: intoServer,
      appVersion: "0.4.0",
      device: name,
      tokenStore: { load: () => saved, save: (t) => { saved = t; } },
    });
    const sync = syncModule.createVaultSync({ session, client });
    const signIn = (create = false) =>
      client.signIn({ server: "https://sync.example.com", email: EMAIL, password: ACCOUNT_PASSWORD, create });
    return { session, client, sync, signIn, titles: () => session.list().map((i) => i.title).sort() };
  }

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "fd-e2e-"));
  });
  afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

  it("puts a local vault on a new account", async () => {
    laptop = pc("laptop");
    await laptop.session.create(PASS);
    const work = laptop.session.add({ kind: "section", content: { title: "Work" } });
    github = laptop.session.add({ kind: "login", parentId: work, content: { title: "GitHub", password: "gH7#pQ2!vLm9xR" } });
    await laptop.signIn(true);
    await laptop.sync.link();
    expect(laptop.sync.status()).toMatchObject({ linked: true, pending: 0, error: null });

    const userId = laptop.client.account().id;
    const raw = JSON.stringify(await ctx.db.collection("vault_items").find({ userId }).toArray());
    expect(raw).toContain(github);
    expect(raw).not.toContain("GitHub");
    expect(raw).not.toContain("gH7#pQ2!vLm9xR");
  });

  it("opens that vault on a second computer with the vault passphrase", async () => {
    desktop = pc("desktop");
    await desktop.signIn();
    expect(await desktop.sync.remote()).toEqual({ hasVault: true, sameVault: false });
    await expect(desktop.sync.join("not the passphrase")).rejects.toMatchObject({ code: "wrong" });
    await desktop.sync.join(PASS);
    expect(desktop.titles()).toEqual(["GitHub", "Work"]);
    expect(desktop.session.open(github).content.password).toBe("gH7#pQ2!vLm9xR");
  });

  it("keeps both versions of a note edited on both computers", async () => {
    laptop.session.update(github, { password: "laptop-version" });
    desktop.session.update(github, { password: "desktop-version" });
    await laptop.sync.syncNow();
    expect((await desktop.sync.syncNow()).conflictCopies).toBe(1);
    await laptop.sync.syncNow();
    for (const computer of [laptop, desktop]) {
      const logins = computer.session.list().filter((i) => i.kind === "login");
      expect(logins.map((i) => computer.session.open(i.id).content.password).sort()).toEqual(["desktop-version", "laptop-version"]);
      expect(computer.sync.status().pending).toBe(0);
    }
  });

  it("carries a passphrase change to the other computer", async () => {
    await laptop.session.changePassphrase(PASS, "a brand new passphrase");
    await laptop.sync.syncNow();
    expect((await desktop.sync.syncNow()).passphraseChanged).toBe(true);
    desktop.session.lock();
    await expect(desktop.session.unlock(PASS)).rejects.toMatchObject({ code: "wrong" });
    expect((await desktop.session.unlock("a brand new passphrase")).state).toBe("unlocked");
    // and a second change in a row still goes through (ifUpdatedAt follows)
    await desktop.session.changePassphrase("a brand new passphrase", "third passphrase here");
    await desktop.sync.syncNow();
    expect((await laptop.sync.syncNow()).passphraseChanged).toBe(true);
  });

  it("signing out ends that computer's session on the server", async () => {
    const fresh = pc("restarted");
    await fresh.signIn();
    const session = await ctx.db.collection("sessions").countDocuments({ device: "restarted" });
    expect(session).toBe(1);
    await fresh.client.signOut();
    expect(await ctx.db.collection("sessions").countDocuments({ device: "restarted" })).toBe(0);
  });

  it("deletes the account from the server; the vault stays on the computer", async () => {
    const userId = laptop.client.account().id;
    await expect(laptop.client.deleteAccount("wrong password")).rejects.toMatchObject({ code: "bad_credentials" });
    await laptop.client.deleteAccount(ACCOUNT_PASSWORD);
    expect(await ctx.db.collection("vault_items").countDocuments({ userId })).toBe(0);
    expect(await ctx.db.collection("vault_keys").countDocuments({ _id: userId })).toBe(0);
    expect(laptop.titles()).toContain("GitHub");
    // The other computer finds out at its next sync, and keeps its vault too.
    await expect(desktop.sync.syncNow()).rejects.toMatchObject({ code: "no_remote_vault" });
    expect(desktop.titles()).toContain("GitHub");
  });
});
