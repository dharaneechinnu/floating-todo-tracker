import { currentSchemaVersion } from "../migrations/index.js";

export default async function metaRoutes(app, { config, db }) {
  app.get("/v1/health", async (_request, reply) => {
    try {
      await db.command({ ping: 1 });
      return { ok: true, db: "up" };
    } catch {
      return reply.code(503).send({ ok: false, db: "down" });
    }
  });

  // What the desktop app checks before syncing (VERSIONING.md, R6).
  app.get("/v1/meta", async () => ({
    api: "v1",
    serverVersion: config.serverVersion,
    schemaVersion: await currentSchemaVersion(db),
    minClient: config.minClient,
    latestClient: config.latestClient,
  }));
}
