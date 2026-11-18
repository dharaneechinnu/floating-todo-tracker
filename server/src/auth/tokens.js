import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

const ISSUER = "focusdock-api";
const AUDIENCE = "focusdock-app";

export function createAccessTokens({ secret, ttlSeconds }) {
  const key = new TextEncoder().encode(secret);
  return {
    ttlSeconds,
    sign(userId) {
      return new SignJWT({})
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(userId)
        .setIssuer(ISSUER)
        .setAudience(AUDIENCE)
        .setIssuedAt()
        .setExpirationTime(`${ttlSeconds}s`)
        .sign(key);
    },
    async verify(token) {
      const { payload } = await jwtVerify(token, key, {
        issuer: ISSUER,
        audience: AUDIENCE,
        algorithms: ["HS256"],
      });
      return payload.sub;
    },
  };
}

// Refresh tokens are random, not JWTs: they are looked up in the database
// anyway, and only their SHA-256 is stored, so a database leak can't be
// replayed as a login.
export function newRefreshToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}
