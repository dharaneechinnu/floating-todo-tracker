import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { createAccessTokens } from "./auth/tokens.js";
import { createSessionStore } from "./auth/sessions.js";
import { compareVersions, isVersion } from "./semver.js";
import metaRoutes from "./routes/meta.js";
import authRoutes from "./routes/auth.js";

// These stay reachable from an outdated app, so it can find out it is
// outdated and say so.
const VERSION_EXEMPT = new Set(["/v1/health", "/v1/meta"]);

export async function buildApp({ config, db, logger = { level: config.logLevel } }) {
  const app = Fastify({ logger, trustProxy: config.trustProxy, bodyLimit: 1024 * 1024 });

  const accessTokens = createAccessTokens({ secret: config.jwtSecret, ttlSeconds: config.accessTtlSeconds });
  const sessions = createSessionStore(db, { refreshTtlDays: config.refreshTtlDays });

  await app.register(rateLimit, { global: false });

  // Every request carries X-FocusDock-Version. Below MIN_CLIENT, the API
  // asks the app to update instead of serving data it may mishandle.
  app.addHook("onRequest", async (request, reply) => {
    if (VERSION_EXEMPT.has(request.routeOptions.url)) return;
    const version = request.headers["x-focusdock-version"];
    if (isVersion(version) && compareVersions(version, config.minClient) < 0) {
      return reply.code(426).send({
        error: "client_outdated",
        message: "Update FocusDock to keep syncing.",
        minClient: config.minClient,
      });
    }
  });

  app.decorateRequest("userId", null);
  app.decorate("authenticate", async (request, reply) => {
    const header = request.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    try {
      request.userId = await accessTokens.verify(token);
    } catch {
      return reply.code(401).send({ error: "unauthorized", message: "Sign in again." });
    }
  });

  app.setErrorHandler((error, request, reply) => {
    if (error.validation) {
      return reply.code(400).send({ error: "invalid_request", message: error.message });
    }
    if (error.statusCode === 429) {
      return reply.code(429).send({ error: "rate_limited", message: "Too many attempts. Try again in a minute." });
    }
    request.log.error(error);
    return reply.code(500).send({ error: "server_error", message: "Something went wrong on the server." });
  });

  await app.register(metaRoutes, { config, db });
  await app.register(authRoutes, { config, db, accessTokens, sessions });
  return app;
}
