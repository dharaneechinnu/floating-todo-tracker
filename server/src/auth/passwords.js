import argon2 from "argon2";

// OWASP's recommended Argon2id minimum: 19 MiB memory, 2 iterations.
const OPTIONS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 };

export function hashPassword(password) {
  return argon2.hash(password, OPTIONS);
}

export async function verifyPassword(hash, password) {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/*
 * Used when a login names an email that has no account, so that request
 * takes as long as a wrong password would. Otherwise response timing
 * reveals which emails are registered.
 */
let dummyHash = null;
export async function burnPasswordCheck(password) {
  dummyHash ??= await argon2.hash("focusdock-timing-equaliser", OPTIONS);
  await verifyPassword(dummyHash, password);
}
