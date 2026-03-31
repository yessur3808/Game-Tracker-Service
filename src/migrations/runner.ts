/**
 * Migration runner – applies/rolls back migrations in filename order.
 *
 * Commands:
 *   up      – apply all pending migrations          (default)
 *   down    – roll back the last applied migration
 *   status  – print applied / pending status for every file
 *
 * Usage (dev):
 *   npm run migrate           # alias for migrate:up
 *   npm run migrate:up
 *   npm run migrate:down
 *   npm run migrate:status
 *
 * Usage (prod, after build):
 *   node dist/migrations/runner.js [up|down|status]
 *
 * Applied migrations are tracked in the `_migrations` collection.
 */
import "reflect-metadata";
import * as fs from "fs";
import * as path from "path";
import { MongoClient, Db, Collection, Document } from "mongodb";

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
  down?: (db: Db) => Promise<void>;
}

type Command = "up" | "down" | "status";

function resolveCommand(arg: string | undefined): Command {
  if (arg === "down") return "down";
  if (arg === "status") return "status";
  return "up";
}

async function main() {
  const command = resolveCommand(process.argv[2]);

  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB;

  if (!uri) throw new Error("Missing env var: MONGODB_URI");
  if (!dbName) throw new Error("Missing env var: MONGODB_DB");

  const client = new MongoClient(uri);
  await client.connect();

  try {
    const db = client.db(dbName);
    const col: Collection<Document> = db.collection(MIGRATIONS_COLLECTION);

    // Discover migration files in the same directory as this runner.
    // Works under ts-node (.ts) and compiled node (.js).
    const dir = __dirname;
    const ext = __filename.endsWith(".ts") ? ".ts" : ".js";
    const files = fs
      .readdirSync(dir)
      .filter((f) => /^\d{3}_/.test(f) && f.endsWith(ext))
      .sort();

    const appliedDocs = await col
      .find({})
      .project({ name: 1, appliedAt: 1 })
      .sort({ appliedAt: 1 })
      .toArray();
    const appliedNames = new Set(appliedDocs.map((d) => d.name as string));

    if (command === "status") {
      await runStatus(files, appliedNames);
      return;
    }

    if (command === "down") {
      await runDown(db, col, files, appliedDocs);
      return;
    }

    // default: up
    await runUp(db, col, files, appliedNames);
  } finally {
    await client.close();
  }
}

async function runStatus(
  files: string[],
  appliedNames: Set<string>,
): Promise<void> {
  if (files.length === 0) {
    console.log("No migration files found.");
    return;
  }
  console.log("Migration status:\n");
  for (const file of files) {
    const state = appliedNames.has(file) ? "applied " : "pending ";
    console.log(`  ${state}  ${file}`);
  }
}

async function runUp(
  db: Db,
  col: Collection<Document>,
  files: string[],
  appliedNames: Set<string>,
): Promise<void> {
  if (files.length === 0) {
    console.log("No migration files found.");
    return;
  }

  let ran = 0;
  for (const file of files) {
    if (appliedNames.has(file)) {
      console.log(`  skip   ${file}`);
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(path.join(__dirname, file)) as MigrationModule;
    const label = mod.description ? ` – ${mod.description}` : "";
    console.log(`  apply  ${file}${label}`);
    await mod.up(db);
    await col.insertOne({
      name: file,
      appliedAt: new Date().toISOString(),
    });
    ran++;
  }

  console.log(
    "\n" +
      (ran === 0
        ? "All migrations already applied."
        : `Done – applied ${ran} migration(s).`),
  );
}

async function runDown(
  db: Db,
  col: Collection<Document>,
  files: string[],
  appliedDocs: Document[],
): Promise<void> {
  // Roll back only the most recently applied migration
  if (appliedDocs.length === 0) {
    console.log("Nothing to roll back – no migrations have been applied.");
    return;
  }

  const lastDoc = appliedDocs[appliedDocs.length - 1];
  const target = lastDoc["name"] as string;

  if (!files.includes(target)) {
    throw new Error(
      `Migration file "${target}" was applied but no longer exists on disk.`,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require(path.join(__dirname, target)) as MigrationModule;

  if (!mod.down) {
    throw new Error(
      `Migration "${target}" does not export a down() function – cannot roll back.`,
    );
  }

  const label = mod.description ? ` – ${mod.description}` : "";
  console.log(`  revert ${target}${label}`);
  await mod.down(db);
  await col.deleteOne({ name: target });

  console.log(`\nDone – rolled back "${target}".`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

