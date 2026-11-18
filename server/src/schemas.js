// Shared JSON schemas for request bodies. Encrypted blobs are base64 text
// made by the desktop app; the server checks their shape and size only.
const b64 = (maxLength) => ({ type: "string", minLength: 1, maxLength, pattern: "^[A-Za-z0-9+/=_-]+$" });

export const UUID_PATTERN = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$";

export const encryptedBlob = (maxCiphertext) => ({
  type: "object",
  required: ["v", "iv", "ct", "tag"],
  additionalProperties: false,
  properties: {
    v: { type: "integer", minimum: 1, maximum: 1000 },
    iv: b64(64),
    ct: b64(maxCiphertext),
    tag: b64(64),
  },
});
