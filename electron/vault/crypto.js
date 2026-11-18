/*
 * Vault encryption. Runs only in the main process; keys never reach the
 * renderer. Uses Node's built-in crypto, so there is no native module to
 * build per platform.
 *
 *   passphrase --scrypt--> master key --wraps--> vault key --encrypts--> items
 *   recovery code --HKDF--> recovery key --wraps--> the same vault key
 *
 * Changing the passphrase only re-wraps the vault key; no item is
 * re-encrypted. Every encrypted blob is { v, iv, ct, tag } (base64), the
 * same shape the server stores.
 */
const crypto = require("crypto");
const { promisify } = require("util");

const scrypt = promisify(crypto.scrypt);

const ENCRYPTION_VERSION = 1;
// N = 2^17 costs ~128 MB and a few hundred ms per unlock: slow for an
// attacker guessing, barely noticeable for the person unlocking.
const DEFAULT_KDF = { alg: "scrypt", N: 131072, r: 8, p: 1 };
const KEY_BYTES = 32;
const IV_BYTES = 12;
const RECOVERY_BYTES = 20; // 160 bits, shown as 8 groups of 4 characters
const BASE32 = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0 or 1 to misread

class WrongSecretError extends Error {
  constructor(message = "That passphrase isn't right.") {
    super(message);
    this.name = "WrongSecretError";
  }
}

const b64 = (buf) => buf.toString("base64");
const unb64 = (str) => Buffer.from(str, "base64");

async function deriveKey(passphrase, kdf) {
  if (kdf.alg !== "scrypt") throw new Error(`Unsupported key derivation: ${kdf.alg}`);
  const secret = String(passphrase).normalize("NFKC");
  return scrypt(secret, unb64(kdf.salt), KEY_BYTES, {
    N: kdf.N,
    r: kdf.r,
    p: kdf.p,
    maxmem: 256 * 1024 * 1024,
  });
}

/*
 * `context` is authenticated but not encrypted (AES-GCM associated data).
 * For items it is the item's id and kind, so a ciphertext copied onto a
 * different item fails to open instead of showing the wrong secret.
 */
function seal(key, plaintext, context = "") {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(context, "utf8"));
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { v: ENCRYPTION_VERSION, iv: b64(iv), ct: b64(ct), tag: b64(cipher.getAuthTag()) };
}

function open(key, blob, context = "") {
  if (!blob || blob.v !== ENCRYPTION_VERSION) {
    throw new Error(`Unsupported encryption version: ${blob && blob.v}`);
  }
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, unb64(blob.iv));
    decipher.setAAD(Buffer.from(context, "utf8"));
    decipher.setAuthTag(unb64(blob.tag));
    return Buffer.concat([decipher.update(unb64(blob.ct)), decipher.final()]);
  } catch {
    throw new WrongSecretError("This data couldn't be decrypted. It may be damaged or belong to another vault.");
  }
}

const sealJson = (key, value, context) => seal(key, Buffer.from(JSON.stringify(value), "utf8"), context);
const openJson = (key, blob, context) => JSON.parse(open(key, blob, context).toString("utf8"));

function itemContext(id, kind) {
  return `item:${id}:${kind}`;
}

function newRecoveryCode() {
  const bytes = crypto.randomBytes(RECOVERY_BYTES);
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return out.match(/.{4}/g).join("-");
}

function normaliseRecoveryCode(code) {
  return String(code).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function recoveryKey(code, salt) {
  const material = normaliseRecoveryCode(code);
  return Buffer.from(crypto.hkdfSync("sha256", material, unb64(salt), "focusdock-recovery-v1", KEY_BYTES));
}

/*
 * A new vault: the header to save (safe to store and upload), the vault key
 * to keep in memory, and the recovery code to show the user exactly once.
 */
async function createVault(passphrase, kdfParams = DEFAULT_KDF) {
  const kdf = {
    ...kdfParams,
    salt: b64(crypto.randomBytes(16)),
    recoverySalt: b64(crypto.randomBytes(16)),
  };
  const vaultKey = crypto.randomBytes(KEY_BYTES);
  const recoveryCode = newRecoveryCode();
  const masterKey = await deriveKey(passphrase, kdf);
  const header = {
    kdf,
    wrappedKey: seal(masterKey, vaultKey, "vault-key"),
    recoveryKey: seal(recoveryKey(recoveryCode, kdf.recoverySalt), vaultKey, "vault-key"),
  };
  return { header, vaultKey, recoveryCode };
}

async function unlockVault(header, passphrase) {
  const masterKey = await deriveKey(passphrase, header.kdf);
  try {
    return open(masterKey, header.wrappedKey, "vault-key");
  } catch {
    throw new WrongSecretError();
  }
}

function unlockWithRecoveryCode(header, code) {
  try {
    return open(recoveryKey(code, header.kdf.recoverySalt), header.recoveryKey, "vault-key");
  } catch {
    throw new WrongSecretError("That recovery code isn't right.");
  }
}

// New passphrase, same vault key: only the passphrase wrapping changes.
async function rewrapWithPassphrase(header, vaultKey, passphrase) {
  const kdf = { ...header.kdf, salt: b64(crypto.randomBytes(16)) };
  const masterKey = await deriveKey(passphrase, kdf);
  return { ...header, kdf, wrappedKey: seal(masterKey, vaultKey, "vault-key") };
}

module.exports = {
  ENCRYPTION_VERSION,
  DEFAULT_KDF,
  WrongSecretError,
  seal,
  open,
  sealJson,
  openJson,
  itemContext,
  newRecoveryCode,
  createVault,
  unlockVault,
  unlockWithRecoveryCode,
  rewrapWithPassphrase,
};
