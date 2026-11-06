/*
 * Feature switches (VERSIONING.md, R8). A new feature ships switched off,
 * goes to testers from the tray's "Beta features" menu, and becomes the
 * default by flipping `default` here, without a separate build.
 *
 * Stored as `features: { name: boolean }` in config.json. Names this build
 * doesn't know are left in the file untouched (R4), so a newer version's
 * switches survive a downgrade.
 */
const FEATURES = {
  vault: { label: "Secret vault", default: false },
  sync: { label: "Sync with an account", default: false },
};

function resolveFeatures(stored) {
  const saved = stored && typeof stored === "object" ? stored : {};
  const result = {};
  for (const [name, def] of Object.entries(FEATURES)) {
    result[name] = typeof saved[name] === "boolean" ? saved[name] : def.default;
  }
  return result;
}

function setFeature(stored, name, enabled) {
  if (!FEATURES[name]) throw new Error(`Unknown feature: ${name}`);
  return { ...(stored && typeof stored === "object" ? stored : {}), [name]: Boolean(enabled) };
}

module.exports = { FEATURES, resolveFeatures, setFeature };
