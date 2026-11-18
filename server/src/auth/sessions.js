import { randomUUID } from "node:crypto";
import { hashToken, newRefreshToken } from "./tokens.js";

/*
 * Refresh-token sessions with rotation and reuse detection.
 *
 * Every refresh swaps the token for a new one in the same "family" and
 * marks the old one rotated. Rotated tokens are kept until they expire, so
 * if one is ever presented again it must have been copied — and every
 * session for that user is revoked, signing out all devices.
 */
export function createSessionStore(db, { refreshTtlDays }) {
  const sessions = db.collection("sessions");
  const ttlMs = refreshTtlDays * 24 * 60 * 60 * 1000;

  async function issue(userId, { family = randomUUID(), device = "" } = {}) {
    const token = newRefreshToken();
    const now = new Date();
    await sessions.insertOne({
      _id: randomUUID(),
      userId,
      tokenHash: hashToken(token),
      family,
      device: String(device).slice(0, 100),
      createdAt: now,
      expiresAt: new Date(now.getTime() + ttlMs),
      rotatedAt: null,
    });
    return token;
  }

  // Returns { userId, token } on success, or { error: "invalid" | "reused" }.
  async function rotate(token) {
    const now = new Date();
    const current = await sessions.findOne({ tokenHash: hashToken(token) });
    if (!current || current.expiresAt <= now) return { error: "invalid" };

    if (current.rotatedAt) {
      await sessions.deleteMany({ userId: current.userId });
      return { error: "reused", userId: current.userId };
    }

    // Only one request may rotate a token; a racing duplicate gets "invalid".
    const claimed = await sessions.findOneAndUpdate(
      { _id: current._id, rotatedAt: null },
      { $set: { rotatedAt: now } }
    );
    if (!claimed) return { error: "invalid" };

    const next = await issue(current.userId, { family: current.family, device: current.device });
    return { userId: current.userId, token: next };
  }

  async function revoke(token) {
    const current = await sessions.findOne({ tokenHash: hashToken(token) });
    if (current) await sessions.deleteMany({ family: current.family });
  }

  return { issue, rotate, revoke };
}
