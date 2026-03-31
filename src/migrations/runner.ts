/**
 * Migration runner – applies pending migrations in ascending filename order.
 *
 * Usage (dev):  npx ts-node src/migrations/runner.ts
 * Usage (prod): node dist/migrations/runner.js
 *
 * Applied migrations are tracked in the `_migrations` collection.
 */
import "reflect-metadata";
import * as fs from "fs";
import * as path from "path";
import { MongoClient, Db } from "mongodb";

// Load .env when running locally (ignore if dotenv is unavailable)
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require("dotenv").config();
} catch {
  // not available in all environments
}

const MIGRATIONS_COLLECTION = "_migrations";

interface MigrationModule {
  description?: string;
  up: (db: Db) => Promise<void>;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB;

  if (!uri) throw new Error("Missing env var: MONGODB_URI");
  if (!dbName) throw new Error("Missing env var: MONGODB_DB");

  const client = new MongoClient(uri);
  await client.connect();

  try {
    const db = client.db(dbName);
    const col = db.collection<{ name: string; appliedAt: string }>(
      MIGRATIONS_COLLECTION,
    );

    const applied = new Set(
      (await col.find({}).project({ name: 1 }).toArray()).map(
        (d) => d.name as string,
      ),
    );

    // Discover migration files in the same directory as this runner.
    // Works under ts-node (.ts) and compiled node (.js).
    const dir = __dirname;
    const ext = __filename.endsWith(".ts") ? ".ts" : ".js";
    const files = fs
      .readdirSync(dir)
      .filter((f) => /^\d{3}_/.test(f) && f.endsWith(ext))
      .sort();

    if (files.length === 0) {
      console.log("No migration files found.");
      return;
    }

    let ran = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`  skip  ${file}`);
        continue;
      }

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(path.join(dir, file)) as MigrationModule;
      const label = mod.description ? ` – ${mod.description}` : "";
      console.log(`  apply ${file}${label}`);
      await mod.up(db);
      await col.insertOne({ name: file, appliedAt: new Date().toISOString() });
      ran++;
    }

    console.log(
      ran === 0
        ? "All migrations already applied."
        : `Done – applied ${ran} migration(s).`,
    );
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
