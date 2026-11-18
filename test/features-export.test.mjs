import { describe, it, expect } from "vitest";
import features from "../electron/features.js";
import exporter from "../electron/export.js";

const { FEATURES, resolveFeatures, setFeature } = features;

describe("feature switches", () => {
  it("uses each feature's default when nothing is stored", () => {
    const resolved = resolveFeatures(undefined);
    for (const [name, def] of Object.entries(FEATURES)) expect(resolved[name]).toBe(def.default);
  });

  it("uses stored booleans and ignores junk", () => {
    expect(resolveFeatures({ vault: true, sync: "yes" })).toMatchObject({ vault: true, sync: false });
  });

  it("keeps switches from a newer version in storage but doesn't expose them (R4)", () => {
    const stored = setFeature({ futureThing: true }, "vault", true);
    expect(stored).toEqual({ futureThing: true, vault: true });
    expect(resolveFeatures(stored)).not.toHaveProperty("futureThing");
  });

  it("refuses unknown names", () => {
    expect(() => setFeature({}, "nope", true)).toThrow(/Unknown feature/);
  });
});

describe("task export", () => {
  it("wraps todos with enough information to import them later", () => {
    const todos = [{ id: 1, uid: "u", text: "Ship 0.2" }];
    const out = exporter.buildTodoExport(todos, { appVersion: "0.2.0", schemaVersion: 2, now: new Date("2026-11-06T10:00:00Z") });
    expect(out).toEqual({
      app: "FocusDock",
      kind: "tasks",
      exportFormat: 1,
      appVersion: "0.2.0",
      schemaVersion: 2,
      exportedAt: "2026-11-06T10:00:00.000Z",
      count: 1,
      todos,
    });
  });

  it("suggests a dated file name in local time", () => {
    expect(exporter.exportFileName(new Date(2026, 0, 5, 23, 30))).toBe("FocusDock tasks 2026-01-05.json");
  });
});
