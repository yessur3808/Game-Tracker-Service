import { Global, Module } from "@nestjs/common";
import { MongoClient, Db } from "mongodb";

export const DB = Symbol("DB");

@Global()
@Module({
  providers: [
    {
      provide: DB,
      useFactory: async (): Promise<Db> => {
        const uri = process.env.MONGODB_URI;
        const dbName = process.env.MONGODB_DB;

        if (!uri) throw new Error("Missing MONGODB_URI");
        if (!dbName) throw new Error("Missing MONGODB_DB");

        const client = new MongoClient(uri);
        await client.connect();
        const db = client.db(dbName);

        await ensureIndexes(db);

        return db;
      },
    },
  ],
  exports: [DB],
})
export class DbModule {}

async function ensureIndexes(db: Db) {
  // games
  await db.collection("games").createIndex({ id: 1 }, { unique: true });
  await db.collection("games").createIndex({ availability: 1 });
  await db.collection("games").createIndex({ "release.status": 1 });
  await db
    .collection("games")
    .createIndex({ "release.dateISO": 1 }, { sparse: true });
  await db.collection("games").createIndex({ platforms: 1 });
  await db.collection("games").createIndex({ "category.type": 1 });
  await db.collection("games").createIndex({ updatedAt: -1 });

  // manual_sources
  await db
    .collection("manual_sources")
    .createIndex({ gameId: 1, createdAt: -1 });
  await db
    .collection("manual_sources")
    .createIndex({ gameId: 1, "source.url": 1 }, { unique: true });

  // manual_overrides
  await db
    .collection("manual_overrides")
    .createIndex({ gameId: 1, enabled: 1, updatedAt: -1 });
  // recommended “only one enabled override per game”
  await db.collection("manual_overrides").createIndex(
    { gameId: 1 },
    {
      unique: true,
      partialFilterExpression: { enabled: true },
      name: "uniq_enabled_override_per_game",
    },
  );

  // audit_log
  await db
    .collection("audit_log")
    .createIndex({ "entity.type": 1, "entity.id": 1, at: -1 });
  await db.collection("audit_log").createIndex({ at: -1 });
}
