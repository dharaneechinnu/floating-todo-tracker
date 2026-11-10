/*
 * A stand-in for the sync server (server/), as a fetch function. It follows
 * the same rules as the real routes: wrapped keys with ifUpdatedAt, "a push
 * only replaces a lower rev", a per-account sequence for pulls, rotating
 * refresh tokens. The real server and MongoDB are exercised by
 * server/test/vault-sync-e2e.test.js with this same app code.
 */
import { randomUUID } from "node:crypto";

export function createFakeServer({ minClient = "0.0.0" } = {}) {
  const users = new Map(); // email -> { id, email, password }
  const refresh = new Map(); // token -> userId
  const access = new Map(); // token -> { userId, expired }
  const keys = new Map(); // userId -> header + updatedAt
  const items = new Map(); // userId -> Map(id -> item)
  const seqs = new Map();
  const log = [];
  let offline = false;
  let clock = Date.parse("2026-11-10T09:00:00Z");

  const json = (status, body) => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
  });

  function tokensFor(userId) {
    const accessToken = `access-${randomUUID()}`;
    const refreshToken = `refresh-${randomUUID()}`;
    access.set(accessToken, { userId, expired: false });
    refresh.set(refreshToken, userId);
    return { accessToken, refreshToken, expiresIn: 900 };
  }

  const older = (a, b) => {
    const [x, y] = [a, b].map((v) => v.split(".").map(Number));
    for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return x[i] < y[i];
    return false;
  };

  async function fetchImpl(url, { method = "GET", headers = {}, body } = {}) {
    if (offline) throw new TypeError("fetch failed");
    const { pathname, searchParams } = new URL(url);
    const payload = body ? JSON.parse(body) : undefined;
    log.push({ method, path: pathname, body: payload });

    if (older(headers["x-focusdock-version"] || "0.0.0", minClient)) {
      return json(426, { error: "client_outdated", message: "Update FocusDock to keep syncing.", minClient });
    }

    if (pathname === "/v1/auth/register") {
      if (users.has(payload.email)) return json(409, { error: "email_taken", message: "An account with this email already exists. Sign in instead." });
      const user = { id: randomUUID(), email: payload.email, password: payload.password };
      users.set(user.email, user);
      return json(201, { user: { id: user.id, email: user.email }, ...tokensFor(user.id) });
    }
    if (pathname === "/v1/auth/login") {
      const user = users.get(payload.email);
      if (!user || user.password !== payload.password) return json(401, { error: "bad_credentials", message: "Email or password is incorrect." });
      return json(200, { user: { id: user.id, email: user.email }, ...tokensFor(user.id) });
    }
    if (pathname === "/v1/auth/refresh") {
      const userId = refresh.get(payload.refreshToken);
      if (!userId) return json(401, { error: "session_expired", message: "Your session has ended. Sign in again." });
      refresh.delete(payload.refreshToken);
      return json(200, tokensFor(userId));
    }
    if (pathname === "/v1/auth/logout") {
      refresh.delete(payload.refreshToken);
      return json(204);
    }

    const session = access.get((headers.authorization || "").replace("Bearer ", ""));
    if (!session || session.expired) return json(401, { error: "unauthorized", message: "Sign in again." });
    const { userId } = session;

    if (pathname === "/v1/vault/keys" && method === "GET") {
      return keys.has(userId) ? json(200, keys.get(userId)) : json(404, { error: "no_vault", message: "This account doesn't have a vault yet." });
    }
    if (pathname === "/v1/vault/keys" && method === "PUT") {
      const { ifUpdatedAt, ...fields } = payload;
      const current = keys.get(userId);
      if (!ifUpdatedAt && current) return json(409, { error: "vault_exists", message: "This account already has a vault." });
      if (ifUpdatedAt && (!current || current.updatedAt !== ifUpdatedAt)) {
        return json(409, { error: "vault_changed", message: "The vault key changed on another computer. Sync, then try again." });
      }
      clock += 1000;
      const doc = { ...fields, updatedAt: new Date(clock).toISOString() };
      keys.set(userId, doc);
      return json(ifUpdatedAt ? 200 : 201, doc);
    }
    if (pathname === "/v1/sync/push") {
      if (!keys.has(userId)) return json(409, { error: "no_vault", message: "Set up the vault on this account before syncing." });
      const mine = items.get(userId) || items.set(userId, new Map()).get(userId);
      const accepted = [];
      const conflicts = [];
      for (const incoming of payload.items) {
        const current = mine.get(incoming.id);
        if (current && current.rev >= incoming.rev) {
          conflicts.push({ id: incoming.id, serverRev: current.rev });
          continue;
        }
        const seq = (seqs.get(userId) || 0) + 1;
        seqs.set(userId, seq);
        clock += 1000;
        mine.set(incoming.id, { ...incoming, parentId: incoming.parentId ?? null, seq, updatedAt: new Date(clock).toISOString() });
        accepted.push({ id: incoming.id, rev: incoming.rev, seq });
      }
      return json(200, { accepted, conflicts, cursor: seqs.get(userId) || 0 });
    }
    if (pathname === "/v1/sync/pull") {
      const since = Number(searchParams.get("since") || 0);
      const limit = 2; // tiny pages, so paging is always exercised
      const all = [...(items.get(userId) || new Map()).values()].filter((i) => i.seq > since).sort((a, b) => a.seq - b.seq);
      const batch = all.slice(0, limit);
      return json(200, { items: batch, cursor: batch.length ? batch[batch.length - 1].seq : since, more: all.length > limit });
    }
    if (pathname === "/v1/account/delete") {
      const user = [...users.values()].find((u) => u.id === userId);
      if (!user || user.password !== payload.password) return json(401, { error: "bad_credentials", message: "That password is incorrect." });
      users.delete(user.email);
      keys.delete(userId);
      items.delete(userId);
      return json(204);
    }
    return json(404, { error: "not_found", message: "Not found" });
  }

  return {
    fetchImpl,
    log,
    stored: () => JSON.stringify([...items.values()].map((m) => [...m.values()])) + JSON.stringify([...keys.values()]),
    setOffline: (value) => { offline = value; },
    expireAccessTokens: () => { for (const s of access.values()) s.expired = true; },
    revokeSessions: () => { refresh.clear(); for (const s of access.values()) s.expired = true; },
    hasUser: (email) => users.has(email),
  };
}
