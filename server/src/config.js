/*
 * All configuration comes from environment variables. Secrets (the MongoDB
 * connection string, the JWT secret) are set in the host's secret store —
 * never committed and never shipped inside the desktop app.
 */
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

export class ConfigError extends Error {}

export function loadConfig(env = process.env) {
  const missing = ["MONGODB_URI", "JWT_SECRET"].filter((key) => !env[key]);
  if (missing.length) {
    throw new ConfigError(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        "Copy server/.env.example to server/.env for local development."
    );
  }
  if (env.JWT_SECRET.length < 32) {
    throw new ConfigError("JWT_SECRET must be at least 32 characters. Generate one with: openssl rand -base64 48");
  }

  return {
    port: Number(env.PORT || 8080),
    host: env.HOST || "0.0.0.0",
    mongoUri: env.MONGODB_URI,
    dbName: env.MONGODB_DB || "focusdock",
    jwtSecret: env.JWT_SECRET,
    accessTtlSeconds: Number(env.ACCESS_TTL_SECONDS || 15 * 60),
    refreshTtlDays: Number(env.REFRESH_TTL_DAYS || 30),
    // Oldest desktop app version allowed to call the API (VERSIONING.md, R6).
    minClient: env.MIN_CLIENT || "0.0.0",
    latestClient: env.LATEST_CLIENT || "0.0.0",
    authRateLimitMax: Number(env.AUTH_RATE_LIMIT_MAX || 5),
    // Render, Railway and Fly all sit behind a proxy; without this every
    // request looks like it comes from the proxy and rate limits break.
    trustProxy: env.TRUST_PROXY !== "false",
    logLevel: env.LOG_LEVEL || "info",
    serverVersion: pkg.version,
  };
}
