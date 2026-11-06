import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { freshDatabase, testApp } from "./helpers.js";
import { compareVersions } from "../src/semver.js";
import { loadConfig, ConfigError } from "../src/config.js";

let ctx;
let app;
beforeAll(async () => {
  ctx = await freshDatabase();
  app = await testApp(ctx.db, { minClient: "0.5.0", latestClient: "0.6.1" });
});
afterAll(async () => {
  await app.close();
  await ctx.drop();
});

describe("meta", () => {
  it("reports health", async () => {
    const res = await app.inject({ url: "/v1/health" });
    expect(res.json()).toEqual({ ok: true, db: "up" });
  });

  it("tells the app which versions are supported", async () => {
    const res = await app.inject({ url: "/v1/meta" });
    expect(res.json()).toMatchObject({ api: "v1", schemaVersion: 1, minClient: "0.5.0", latestClient: "0.6.1" });
  });

  it("asks an outdated app to update, but still serves /v1/meta to it", async () => {
    const headers = { "x-focusdock-version": "0.4.9" };
    const blocked = await app.inject({ method: "POST", url: "/v1/auth/login", headers, payload: { email: "a@b.co", password: "whatever-long" } });
    expect(blocked.statusCode).toBe(426);
    expect(blocked.json()).toMatchObject({ error: "client_outdated", minClient: "0.5.0" });
    expect((await app.inject({ url: "/v1/meta", headers })).statusCode).toBe(200);
  });

  it("lets a current app through", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/auth/login", headers: { "x-focusdock-version": "0.5.0-beta.2" }, payload: { email: "a@b.co", password: "whatever-long" } });
    expect(res.statusCode).toBe(401);
  });
});

describe("helpers", () => {
  it("compares versions", () => {
    expect(compareVersions("0.4.9", "0.5.0")).toBe(-1);
    expect(compareVersions("1.0.0", "0.10.3")).toBe(1);
    expect(compareVersions("0.5.0-beta.1", "0.5.0")).toBe(0);
  });

  it("explains missing configuration", () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
    expect(() => loadConfig({ MONGODB_URI: "x", JWT_SECRET: "short" })).toThrow(/32 characters/);
  });
});
