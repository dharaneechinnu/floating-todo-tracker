/*
 * The FocusDock account on this computer, and every call to the sync
 * server (server/). Main process only.
 *
 * - The access token lives in memory and lasts 15 minutes; the refresh
 *   token is handed to `tokenStore`, which main.js backs with the
 *   operating system's own encryption (Electron safeStorage).
 * - Every request carries X-FocusDock-Version, so the server can tell an
 *   outdated app to update (VERSIONING.md, R6) instead of serving it data
 *   it may mishandle.
 * - Errors come back as SyncError with a `code` the screens can act on and
 *   a message that can be shown as-is.
 *
 * `fetchImpl` and `tokenStore` are passed in, so this runs in plain Node
 * for tests.
 */
class SyncError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.code = code;
    Object.assign(this, extra);
  }
}

const REQUEST_TIMEOUT_MS = 20_000;
// Refresh a little early so a request never leaves with a token that
// expires on the way.
const EXPIRY_MARGIN_MS = 30_000;

/*
 * Only https, except a server on this same computer (development). An
 * account password must never travel over plain http.
 */
function normaliseServerUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) throw new SyncError("no_server", "Enter the address of your FocusDock sync server.");
  let url;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    throw new SyncError("bad_server", "That server address doesn't look right.");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) {
    throw new SyncError("bad_server", "The server address must start with https://");
  }
  if (url.username || url.password) throw new SyncError("bad_server", "That server address doesn't look right.");
  return url.origin;
}

function createSyncClient({
  fetchImpl,
  tokenStore,
  appVersion = "0.0.0",
  device = "",
  defaultServerUrl = "",
  now = () => Date.now(),
  onAccountChange = () => {},
}) {
  const saved = tokenStore.load() || {};
  let serverUrl = saved.serverUrl || "";
  let user = saved.user && saved.refreshToken ? saved.user : null;
  let refreshToken = user ? saved.refreshToken : null;
  let accessToken = null;
  let accessExpiresAt = 0;
  let refreshing = null;

  function persist() {
    tokenStore.save(user ? { serverUrl, user, refreshToken } : { serverUrl });
  }

  function forget() {
    const had = Boolean(user);
    user = null;
    refreshToken = null;
    accessToken = null;
    accessExpiresAt = 0;
    persist();
    if (had) onAccountChange(null);
  }

  async function send(method, path, body, token) {
    const headers = { "x-focusdock-version": appVersion };
    if (body !== undefined) headers["content-type"] = "application/json";
    if (token) headers.authorization = `Bearer ${token}`;

    let response;
    try {
      response = await fetchImpl(`${serverUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new SyncError("offline", "Can't reach the sync server. Your vault still works; it will sync when you're back online.");
    }

    let payload = null;
    try {
      const text = await response.text();
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }
    if (response.ok) return payload;

    if (response.status === 426) {
      throw new SyncError("update_required", "Update FocusDock to keep syncing. Your vault still works on this computer.", { status: 426 });
    }
    const code = (payload && payload.error) || (response.status >= 500 ? "server_error" : "request_failed");
    const message = (payload && payload.message) || "The sync server couldn't handle that. Try again in a moment.";
    throw new SyncError(code, message, { status: response.status, body: payload });
  }

  function takeTokens(tokens) {
    accessToken = tokens.accessToken;
    refreshToken = tokens.refreshToken;
    accessExpiresAt = now() + tokens.expiresIn * 1000;
    persist();
  }

  // One refresh at a time: refresh tokens rotate, and presenting the same
  // one twice makes the server sign every device out.
  function refresh() {
    if (!refreshing) {
      refreshing = (async () => {
        try {
          takeTokens(await send("POST", "/v1/auth/refresh", { refreshToken }));
        } catch (error) {
          if (error.status === 401) {
            forget();
            throw new SyncError("signed_out", "Your session has ended. Sign in again to keep syncing.");
          }
          throw error;
        }
      })().finally(() => {
        refreshing = null;
      });
    }
    return refreshing;
  }

  // An authenticated call. Returns the parsed JSON body.
  async function request(method, path, body) {
    if (!user) throw new SyncError("signed_out", "Sign in to sync.");
    if (!accessToken || now() > accessExpiresAt - EXPIRY_MARGIN_MS) await refresh();
    try {
      return await send(method, path, body, accessToken);
    } catch (error) {
      if (error.status !== 401) throw error;
    }
    // The token was refused although it looked fresh (clock drift, or the
    // server restarted with a new secret): refresh once and retry.
    await refresh();
    return send(method, path, body, accessToken);
  }

  async function signIn({ server, email, password, create = false }) {
    const target = normaliseServerUrl(server || serverUrl || defaultServerUrl);
    if (user) await signOut();
    serverUrl = target;
    const result = await send("POST", create ? "/v1/auth/register" : "/v1/auth/login", {
      email: String(email || ""),
      password: String(password || ""),
      device,
    });
    user = { id: result.user.id, email: result.user.email };
    takeTokens(result);
    onAccountChange(user);
    return user;
  }

  async function signOut() {
    const token = refreshToken;
    forget();
    // Best effort: the session also simply expires on the server.
    if (token) await send("POST", "/v1/auth/logout", { refreshToken: token }).catch(() => {});
  }

  // Removes the account and everything stored for it on the server. The
  // vault on this computer is not touched.
  async function deleteAccount(password) {
    await request("POST", "/v1/account/delete", { password: String(password || "") });
    forget();
  }

  return {
    account: () => (user ? { ...user } : null),
    serverUrl: () => serverUrl || defaultServerUrl,
    request,
    signIn,
    signOut,
    deleteAccount,
  };
}

module.exports = { createSyncClient, SyncError, normaliseServerUrl };
