import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MIGRATIONS, NewerDatabaseError, currentSchemaVersion, runMigrations, validateMigrations } from "../src/migrations/index.js";
import { freshDatabase } from "./helpers.js";

let ctx;
beforeEach(async () => { ctx = await freshDatabase(); });
afterEach(async () => { await ctx.drop(); });

describe("server migrations", () => {
  it("creates every collection with its indexes", async () => {
    const result = await runMigrations(ctx.db);
    expect(result).toEqual({ from: 0, to: MIGRATIONS.length, applied: [1] });

    const names = (await ctx.db.listCollections().toArray()).map((c) => c.name);
    for (const name of ["users", "sessions", "vault_keys", "vault_items", "counters", "migrations"]) {
      expect(names).toContain(name);
    }
    const sessionIndexes = await ctx.db.collection("sessions").indexes();
    expect(sessionIndexes.find((i) => i.name === "expire").expireAfterSeconds).toBe(0);
    const itemIndexes = await ctx.db.collection("vault_items").indexes();
    expect(itemIndexes.find((i) => i.name === "pull_cursor").unique).toBe(true);
  });

  it("is a no-op the second time", async () => {
    await runMigrations(ctx.db);
    expect(await runMigrations(ctx.db)).toEqual({ from: 1, to: 1, applied: [] });
    expect(await currentSchemaVersion(ctx.db)).toBe(1);
  });

  it("applies each step once when two servers start together", async () => {
    const [a, b] = await Promise.all([runMigrations(ctx.db), runMigrations(ctx.db)]);
    expect([...a.applied, ...b.applied]).toEqual([1]);
    expect(await ctx.db.collection("migrations").countDocuments()).toBe(1);
  });

  it("refuses to run against a newer database", async () => {
    await runMigrations(ctx.db);
    await ctx.db.collection("migrations").insertOne({ _id: 2, description: "from the future", appliedAt: new Date() });
    await expect(runMigrations(ctx.db)).rejects.toBeInstanceOf(NewerDatabaseError);
    // and the lock is released afterwards
    expect(await ctx.db.collection("migrations_lock").countDocuments()).toBe(0);
  });

  it("rejects documents that break the validators, but keeps unknown fields", async () => {
    await runMigrations(ctx.db);
    const users = ctx.db.collection("users");
    await expect(users.insertOne({ _id: "u1", email: "a@b.co" })).rejects.toMatchObject({ code: 121 });
    await users.insertOne({ _id: "u2", email: "a@b.co", passwordHash: "h", createdAt: new Date(), futureField: 1 });
    expect((await users.findOne({ _id: "u2" })).futureField).toBe(1);
  });

  it("rejects vault items that aren't encrypted", async () => {
    await runMigrations(ctx.db);
    const items = ctx.db.collection("vault_items");
    const base = { _id: "i1", userId: "u1", kind: "note", parentId: null, rev: 1, deleted: false, seq: 1, updatedAt: new Date() };
    await expect(items.insertOne({ ...base, data: { title: "plain text" } })).rejects.toMatchObject({ code: 121 });
    await items.insertOne({ ...base, data: { v: 1, iv: "aa", ct: "bb", tag: "cc" } });
  });

  it("rejects a migration list with gaps", () => {
    expect(() => validateMigrations([{ version: 2, up() {} }])).toThrow(/out of order/);
  });
});
