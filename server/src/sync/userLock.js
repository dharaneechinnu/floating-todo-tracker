/*
 * One push at a time per user.
 *
 * Every saved item gets the next number in the user's sequence, and pull
 * hands out "everything after number N". If two pushes from the same user
 * ran at once, number 12 could be saved before number 11, a pull in
 * between would move the cursor past 11, and that item would never reach
 * the other computer. Holding a short lock on the user's counter while
 * pushing keeps the saved numbers gap-free and in order.
 *
 * This works on a standalone MongoDB (local Docker) and on Atlas alike,
 * without needing transactions.
 */
const LOCK_MS = 15_000;

export class LockBusyError extends Error {}

export async function withUserLock(db, userId, fn, { waitMs = 5_000, pollMs = 50 } = {}) {
  const counters = db.collection("counters");
  const deadline = Date.now() + waitMs;

  for (;;) {
    const now = new Date();
    const claimed = await counters.findOneAndUpdate(
      { _id: userId, $or: [{ lockedUntil: { $lt: now } }, { lockedUntil: { $exists: false } }] },
      { $set: { lockedUntil: new Date(now.getTime() + LOCK_MS) } },
      { returnDocument: "after" }
    );
    if (claimed) {
      try {
        return await fn(claimed.seq);
      } finally {
        await counters.updateOne({ _id: userId }, { $set: { lockedUntil: new Date(0) } });
      }
    }

    // First push for this user: create the counter, then try again.
    try {
      await counters.insertOne({ _id: userId, seq: 0, lockedUntil: new Date(0) });
      continue;
    } catch (error) {
      if (error.code !== 11000) throw error;
    }

    if (Date.now() > deadline) throw new LockBusyError("Another sync for this account is still running");
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}
