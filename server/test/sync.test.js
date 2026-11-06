import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { freshDatabase, testApp } from "./helpers.js";
import { MAX_CIPHERTEXT, MAX_PUSH } from "../src/routes/sync.js";

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

const blob = (n = 1) => ({ v: 1, iv: "aXYtaXYtaXYtaXYt", ct: `Y2lwaGVy${n}`, tag: "dGFnLXRhZy10YWctdGFn" });
const KEYS = {
  kdf: { alg: "scrypt", N: 131072, r: 8, p: 1, salt: "c2FsdHNhbHRzYWx0c2FsdA" },
  wrappedKey: blob(1),
  recoveryKey: blob(2),
};

async function signUp(email) {
  const res = await app.inject({ method: "POST", url: "/v1/auth/register", payload: { email, password: "a long passphrase" } });
  const { accessToken } = res.json();
  const call = (method, url, payload) =>
    app.inject({ method, url, payload, headers: { authorization: `Bearer ${accessToken}` } });
  return { call };
}

function note(overrides = {}) {
  return { id: randomUUID(), kind: "note", parentId: null, data: blob(), rev: 1, deleted: false, ...overrides };
}

describe("vault keys", () => {
  let alice;
  beforeAll(async () => { alice = await signUp("alice@example.com"); });

  it("starts with no vault", async () => {
    const res = await alice.call("GET", "/v1/vault/keys");
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("no_vault");
  });

  it("refuses pushes before a vault exists", async () => {
    const res = await alice.call("POST", "/v1/sync/push", { items: [note()] });
    expect(res.statusCode).toBe(409);
  });

  it("creates the vault once", async () => {
    expect((await alice.call("PUT", "/v1/vault/keys", KEYS)).statusCode).toBe(201);
    const again = await alice.call("PUT", "/v1/vault/keys", KEYS);
    expect(again.statusCode).toBe(409);
    expect(again.json().error).toBe("vault_exists");
  });

  it("replaces the key only with the latest updatedAt", async () => {
    const { updatedAt } = (await alice.call("GET", "/v1/vault/keys")).json();
    const changed = { ...KEYS, wrappedKey: blob(9), ifUpdatedAt: updatedAt };
    const ok = await alice.call("PUT", "/v1/vault/keys", changed);
    expect(ok.statusCode).toBe(200);
    expect(ok.json().wrappedKey.ct).toBe("Y2lwaGVy9");

    const stale = await alice.call("PUT", "/v1/vault/keys", { ...changed, wrappedKey: blob(3) });
    expect(stale.statusCode).toBe(409);
    expect(stale.json().error).toBe("vault_changed");
  });

  it("rejects keys that aren't encrypted blobs", async () => {
    const res = await alice.call("PUT", "/v1/vault/keys", { ...KEYS, wrappedKey: { plain: "key" } });
    expect(res.statusCode).toBe(400);
  });
});

describe("push and pull", () => {
  let bob;
  const section = note({ kind: "section" });
  const child = note({ parentId: section.id });

  beforeAll(async () => {
    bob = await signUp("bob@example.com");
    await bob.call("PUT", "/v1/vault/keys", KEYS);
  });

  it("accepts new items and numbers them in order", async () => {
    const res = await bob.call("POST", "/v1/sync/push", { items: [section, child] });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.accepted.map((a) => a.seq)).toEqual([1, 2]);
    expect(body.conflicts).toEqual([]);
    expect(body.cursor).toBe(2);
  });

  it("pulls everything after a cursor", async () => {
    const all = (await bob.call("GET", "/v1/sync/pull?since=0")).json();
    expect(all.items.map((i) => i.id)).toEqual([section.id, child.id]);
    expect(all.items[1]).toMatchObject({ parentId: section.id, kind: "note", rev: 1, deleted: false });
    expect(all).toMatchObject({ cursor: 2, more: false });

    const none = (await bob.call("GET", "/v1/sync/pull?since=2")).json();
    expect(none).toEqual({ items: [], cursor: 2, more: false });
  });

  it("accepts a newer rev and moves the item to the end of the sequence", async () => {
    const res = (await bob.call("POST", "/v1/sync/push", { items: [{ ...child, rev: 2, data: blob(5) }] })).json();
    expect(res.accepted).toEqual([{ id: child.id, rev: 2, seq: 3 }]);
    const pulled = (await bob.call("GET", "/v1/sync/pull?since=2")).json();
    expect(pulled.items).toHaveLength(1);
    expect(pulled.items[0].data.ct).toBe("Y2lwaGVy5");
  });

  it("reports a conflict for an older or equal rev and keeps the server copy", async () => {
    const res = (await bob.call("POST", "/v1/sync/push", { items: [{ ...child, rev: 2, data: blob(7) }] })).json();
    expect(res.accepted).toEqual([]);
    expect(res.conflicts).toEqual([{ id: child.id, serverRev: 2 }]);
    expect(res.cursor).toBe(3);
    const stored = await ctx.db.collection("vault_items").findOne({ _id: child.id });
    expect(stored.data.ct).toBe("Y2lwaGVy5");
  });

  it("syncs deletes as tombstones", async () => {
    await bob.call("POST", "/v1/sync/push", { items: [{ ...section, rev: 2, deleted: true }] });
    const pulled = (await bob.call("GET", "/v1/sync/pull?since=3")).json();
    expect(pulled.items[0]).toMatchObject({ id: section.id, deleted: true, rev: 2 });
  });

  it("pages through large pulls", async () => {
    const batch = Array.from({ length: 5 }, () => note());
    await bob.call("POST", "/v1/sync/push", { items: batch });
    const first = (await bob.call("GET", "/v1/sync/pull?since=4&limit=3")).json();
    expect(first.items).toHaveLength(3);
    expect(first.more).toBe(true);
    const second = (await bob.call("GET", `/v1/sync/pull?since=${first.cursor}&limit=3`)).json();
    expect(second.items).toHaveLength(2);
    expect(second.more).toBe(false);
    expect([...first.items, ...second.items].map((i) => i.id)).toEqual(batch.map((i) => i.id));
  });

  it("keeps the sequence gap-free when one user pushes from two computers at once", async () => {
    const before = (await bob.call("GET", "/v1/sync/pull?since=0&limit=500")).json().cursor;
    const pushes = Array.from({ length: 6 }, () => bob.call("POST", "/v1/sync/push", { items: [note(), note()] }));
    const results = await Promise.all(pushes);
    expect(results.every((r) => r.statusCode === 200)).toBe(true);

    const pulled = (await bob.call("GET", `/v1/sync/pull?since=${before}`)).json();
    const seqs = pulled.items.map((i) => i.seq);
    expect(seqs).toEqual(Array.from({ length: 12 }, (_, i) => before + 1 + i));
  });

  it("accepts a full batch of the largest allowed items in one request", async () => {
    const big = "A".repeat(MAX_CIPHERTEXT);
    const batch = Array.from({ length: MAX_PUSH }, () => note({ data: { ...blob(), ct: big } }));
    const res = await bob.call("POST", "/v1/sync/push", { items: batch });
    expect(res.statusCode).toBe(200);
    expect(res.json().accepted).toHaveLength(MAX_PUSH);
  }, 60_000);

  it("still refuses an item over the ciphertext limit", async () => {
    const res = await bob.call("POST", "/v1/sync/push", { items: [note({ data: { ...blob(), ct: "A".repeat(MAX_CIPHERTEXT + 1) } })] });
    expect(res.statusCode).toBe(400);
  });

  it("rejects bad pushes", async () => {
    expect((await bob.call("POST", "/v1/sync/push", { items: [note({ id: "not-a-uuid" })] })).statusCode).toBe(400);
    expect((await bob.call("POST", "/v1/sync/push", { items: [note({ data: { title: "plain" } })] })).statusCode).toBe(400);
    const dup = note();
    expect((await bob.call("POST", "/v1/sync/push", { items: [dup, dup] })).json().error).toBe("duplicate_items");
    expect((await bob.call("POST", "/v1/sync/push", { items: [] })).statusCode).toBe(400);
  });

  it("requires sign-in", async () => {
    expect((await app.inject({ url: "/v1/sync/pull" })).statusCode).toBe(401);
    expect((await app.inject({ url: "/v1/vault/keys" })).statusCode).toBe(401);
  });
});

describe("accounts are isolated", () => {
  it("never shows or overwrites another account's items", async () => {
    const carol = await signUp("carol@example.com");
    const dave = await signUp("dave@example.com");
    await carol.call("PUT", "/v1/vault/keys", KEYS);
    await dave.call("PUT", "/v1/vault/keys", KEYS);

    const secret = note();
    await carol.call("POST", "/v1/sync/push", { items: [secret] });

    expect((await dave.call("GET", "/v1/sync/pull?since=0")).json().items).toEqual([]);

    const hijack = (await dave.call("POST", "/v1/sync/push", { items: [{ ...secret, rev: 99, data: blob(8) }] })).json();
    expect(hijack.accepted).toEqual([]);
    expect(hijack.conflicts).toEqual([{ id: secret.id, serverRev: null }]);
    const stored = await ctx.db.collection("vault_items").findOne({ _id: secret.id });
    expect(stored).toMatchObject({ userId: expect.any(String), rev: 1 });
    expect(stored.data.ct).toBe(blob().ct);

    expect((await dave.call("GET", "/v1/vault/keys")).json().wrappedKey).toEqual(KEYS.wrappedKey);
  });
});
