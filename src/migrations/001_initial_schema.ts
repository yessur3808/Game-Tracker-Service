/**
 * 001 – Initial schema
 *
 * Creates all indexes required by the application.
 * Mirrors the ensureIndexes() call in db.module.ts so that fresh
 * environments can be bootstrapped via the migration runner rather
 * than relying solely on app startup.
 */
import { Db } from "mongodb";

export const description = "Initial schema – all collection indexes";

export async function up(db: Db): Promise<void> {
  // ── games ────────────────────────────────────────────────────────────────
  await db.collection("games").createIndex({ id: 1 }, { unique: true });
  await db.collection("games").createIndex({ availability: 1 });
  await db.collection("games").createIndex({ "release.status": 1 });
  await db
    .collection("games")
    .createIndex({ "release.dateISO": 1 }, { sparse: true });
  await db.collection("games").createIndex({ platforms: 1 });
  await db.collection("games").createIndex({ "category.type": 1 });
  await db.collection("games").createIndex({ updatedAt: -1 });
  await db
    .collection("games")
    .createIndex({ name: "text" }, { name: "games_name_text" });
  await db.collection("games").createIndex(
    { availability: 1, "release.dateISO": 1 },
    { name: "avail_releaseDate", sparse: true },
  );
  await db.collection("games").createIndex(
    { "category.type": 1, updatedAt: -1 },
    { name: "catType_updatedAt" },
  );
  await db.collection("games").createIndex(
    { platforms: 1, updatedAt: -1 },
    { name: "platform_updatedAt" },
  );
  await db.collection("games").createIndex(
    { "externalIds.steam": 1 },
    { sparse: true, name: "extId_steam" },
  );
  await db.collection("games").createIndex(
    { "externalIds.igdb": 1 },
    { sparse: true, name: "extId_igdb" },
  );
  await db
    .collection("games")
    .createIndex({ lastIngestedAt: -1 }, { sparse: true });

  // ── manual_sources ───────────────────────────────────────────────────────
  await db
    .collection("manual_sources")
    .createIndex({ gameId: 1, createdAt: -1 });
  await db
    .collection("manual_sources")
    .createIndex({ gameId: 1, "source.url": 1 }, { unique: true });

  // ── manual_overrides ─────────────────────────────────────────────────────
  await db
    .collection("manual_overrides")
    .createIndex({ gameId: 1, enabled: 1, updatedAt: -1 });
  await db.collection("manual_overrides").createIndex(
    { gameId: 1 },
    {
      unique: true,
      partialFilterExpression: { enabled: true },
      name: "uniq_enabled_override_per_game",
    },
  );

  // ── audit_log ────────────────────────────────────────────────────────────
  await db
    .collection("audit_log")
    .createIndex({ "entity.type": 1, "entity.id": 1, at: -1 });
  await db.collection("audit_log").createIndex({ at: -1 });
  await db.collection("audit_log").createIndex(
    { at: 1 },
    { expireAfterSeconds: 180 * 24 * 3600, name: "audit_ttl" },
  );

  // ── ingestion_runs ───────────────────────────────────────────────────────
  await db.collection("ingestion_runs").createIndex({ startedAt: -1 });
  await db
    .collection("ingestion_runs")
    .createIndex({ status: 1, startedAt: -1 });
}
