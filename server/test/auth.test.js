import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { freshDatabase, testApp } from "./helpers.js";

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

const PASSWORD = "correct horse battery";
const post = (url, payload) => app.inject({ method: "POST", url, payload });

describe("accounts", () => {
  let tokens;

  it("registers and returns a token pair", async () => {
    const res = await post("/v1/auth/register", { email: "  Dharan@Example.COM ", password: PASSWORD, device: "Work laptop" });
    expect(res.statusCode).toBe(201);
    tokens = res.json();
    expect(tokens.user.email).toBe("dharan@example.com");
    expect(tokens.accessToken.split(".")).toHaveLength(3);
    expect(tokens.refreshToken.length).toBeGreaterThan(30);
    expect(tokens.expiresIn).toBe(900);

    const stored = await ctx.db.collection("users").findOne({ email: "dharan@example.com" });
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
    const session = await ctx.db.collection("sessions").findOne({ userId: stored._id });
    expect(session.tokenHash).not.toBe(tokens.refreshToken);
    expect(session.device).toBe("Work laptop");
  });

  it("refuses a second account with the same email", async () => {
    const res = await post("/v1/auth/register", { email: "dharan@example.com", password: PASSWORD });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("email_taken");
  });

  it("rejects short passwords and malformed emails", async () => {
    expect((await post("/v1/auth/register", { email: "x@y.co", password: "short" })).statusCode).toBe(400);
    expect((await post("/v1/auth/register", { email: "not-an-email", password: PASSWORD })).json().error).toBe("invalid_email");
  });

  it("gives the same answer for a wrong password and an unknown email", async () => {
    const wrong = await post("/v1/auth/login", { email: "dharan@example.com", password: "wrong password!" });
    const unknown = await post("/v1/auth/login", { email: "nobody@example.com", password: PASSWORD });
    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrong.json()).toEqual(unknown.json());
  });

  it("signs in", async () => {
    const res = await post("/v1/auth/login", { email: "DHARAN@example.com", password: PASSWORD });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.email).toBe("dharan@example.com");
  });

  it("serves /v1/me only with a valid access token", async () => {
    const ok = await app.inject({ url: "/v1/me", headers: { authorization: `Bearer ${tokens.accessToken}` } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().email).toBe("dharan@example.com");

    expect((await app.inject({ url: "/v1/me" })).statusCode).toBe(401);
    const forged = tokens.accessToken.slice(0, -4) + "AAAA";
    expect((await app.inject({ url: "/v1/me", headers: { authorization: `Bearer ${forged}` } })).statusCode).toBe(401);
  });

  it("rotates the refresh token", async () => {
    const res = await post("/v1/auth/refresh", { refreshToken: tokens.refreshToken });
    expect(res.statusCode).toBe(200);
    const next = res.json();
    expect(next.refreshToken).not.toBe(tokens.refreshToken);
    tokens = { ...tokens, previous: tokens.refreshToken, ...next };
  });

  it("signs out every device when an old refresh token is reused", async () => {
    const userId = (await ctx.db.collection("users").findOne({ email: "dharan@example.com" }))._id;
    expect(await ctx.db.collection("sessions").countDocuments({ userId, rotatedAt: null })).toBeGreaterThan(1);

    const reuse = await post("/v1/auth/refresh", { refreshToken: tokens.previous });
    expect(reuse.statusCode).toBe(401);
    expect(await ctx.db.collection("sessions").countDocuments({ userId })).toBe(0);

    // the current token died with them
    expect((await post("/v1/auth/refresh", { refreshToken: tokens.refreshToken })).statusCode).toBe(401);
  });

  it("logs out one session", async () => {
    const login = (await post("/v1/auth/login", { email: "dharan@example.com", password: PASSWORD })).json();
    expect((await post("/v1/auth/logout", { refreshToken: login.refreshToken })).statusCode).toBe(204);
    expect((await post("/v1/auth/refresh", { refreshToken: login.refreshToken })).statusCode).toBe(401);
  });
});

describe("rate limiting", () => {
  it("blocks the 6th login attempt in a minute", async () => {
    const limited = await testApp(ctx.db, { authRateLimitMax: 5 });
    const codes = [];
    for (let i = 0; i < 6; i += 1) {
      const res = await limited.inject({ method: "POST", url: "/v1/auth/login", payload: { email: "a@b.co", password: "wrong password" } });
      codes.push(res.statusCode);
    }
    expect(codes).toEqual([401, 401, 401, 401, 401, 429]);
    await limited.close();
  });
});
