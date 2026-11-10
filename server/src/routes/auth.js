import { randomUUID } from "node:crypto";
import { burnPasswordCheck, hashPassword, verifyPassword } from "../auth/passwords.js";

const credentials = {
  type: "object",
  required: ["email", "password"],
  additionalProperties: false,
  properties: {
    email: { type: "string", minLength: 3, maxLength: 254 },
    password: { type: "string", minLength: 10, maxLength: 256 },
    device: { type: "string", maxLength: 100 },
  },
};

const refreshBody = {
  type: "object",
  required: ["refreshToken"],
  additionalProperties: false,
  properties: { refreshToken: { type: "string", minLength: 20, maxLength: 200 } },
};

const deleteBody = {
  type: "object",
  required: ["password"],
  additionalProperties: false,
  properties: { password: { type: "string", minLength: 1, maxLength: 256 } },
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normaliseEmail(email) {
  return email.trim().toLowerCase();
}

export default async function authRoutes(app, { config, db, accessTokens, sessions }) {
  const users = db.collection("users");
  const authLimit = { rateLimit: { max: config.authRateLimitMax, timeWindow: "1 minute" } };

  async function tokensFor(userId, device) {
    return {
      accessToken: await accessTokens.sign(userId),
      refreshToken: await sessions.issue(userId, { device }),
      expiresIn: accessTokens.ttlSeconds,
    };
  }

  app.post("/v1/auth/register", { schema: { body: credentials }, config: authLimit }, async (request, reply) => {
    const email = normaliseEmail(request.body.email);
    if (!EMAIL.test(email)) {
      return reply.code(400).send({ error: "invalid_email", message: "Enter a valid email address." });
    }

    const user = {
      _id: randomUUID(),
      email,
      passwordHash: await hashPassword(request.body.password),
      createdAt: new Date(),
    };
    try {
      await users.insertOne(user);
    } catch (error) {
      if (error.code === 11000) {
        return reply.code(409).send({
          error: "email_taken",
          message: "An account with this email already exists. Sign in instead.",
        });
      }
      throw error;
    }

    return reply.code(201).send({
      user: { id: user._id, email },
      ...(await tokensFor(user._id, request.body.device)),
    });
  });

  app.post("/v1/auth/login", { schema: { body: credentials }, config: authLimit }, async (request, reply) => {
    const email = normaliseEmail(request.body.email);
    const user = await users.findOne({ email });
    const ok = user
      ? await verifyPassword(user.passwordHash, request.body.password)
      : (await burnPasswordCheck(request.body.password), false);

    if (!ok) {
      return reply.code(401).send({ error: "bad_credentials", message: "Email or password is incorrect." });
    }
    return { user: { id: user._id, email }, ...(await tokensFor(user._id, request.body.device)) };
  });

  app.post(
    "/v1/auth/refresh",
    { schema: { body: refreshBody }, config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const result = await sessions.rotate(request.body.refreshToken);
      if (result.error === "reused") {
        request.log.warn({ userId: result.userId }, "refresh token reuse; all sessions revoked");
      }
      if (result.error) {
        return reply.code(401).send({ error: "session_expired", message: "Your session has ended. Sign in again." });
      }
      return {
        accessToken: await accessTokens.sign(result.userId),
        refreshToken: result.token,
        expiresIn: accessTokens.ttlSeconds,
      };
    }
  );

  app.post("/v1/auth/logout", { schema: { body: refreshBody } }, async (request, reply) => {
    await sessions.revoke(request.body.refreshToken);
    return reply.code(204).send();
  });

  /*
   * Delete the account and everything stored for it. Asks for the password
   * again: an access token alone (15 minutes, held in the app's memory)
   * must not be enough to destroy an account. The vault on the user's own
   * computers is untouched; only the server's copy goes.
   */
  app.post(
    "/v1/account/delete",
    { preHandler: app.authenticate, schema: { body: deleteBody }, config: authLimit },
    async (request, reply) => {
      const user = await users.findOne({ _id: request.userId });
      if (!user || !(await verifyPassword(user.passwordHash, request.body.password))) {
        return reply.code(401).send({ error: "bad_credentials", message: "That password is incorrect." });
      }
      // Sessions first, so no device can refresh its way back in while the
      // rest is being removed. The user record goes last: if this stops
      // halfway, signing in and deleting again finishes the job.
      await db.collection("sessions").deleteMany({ userId: user._id });
      await db.collection("vault_items").deleteMany({ userId: user._id });
      await db.collection("vault_keys").deleteOne({ _id: user._id });
      await db.collection("counters").deleteOne({ _id: user._id });
      await users.deleteOne({ _id: user._id });
      return reply.code(204).send();
    }
  );

  app.get("/v1/me", { preHandler: app.authenticate }, async (request, reply) => {
    const user = await users.findOne({ _id: request.userId }, { projection: { email: 1, createdAt: 1 } });
    if (!user) return reply.code(401).send({ error: "unauthorized", message: "Sign in again." });
    return { id: user._id, email: user.email, createdAt: user.createdAt };
  });
}
