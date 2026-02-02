import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Db } from "mongodb";
import { DB } from "../db.module";
import { AuditService } from "../audit/service";
import { Game } from "../../shared/types";
import { GameSchema } from "../../shared/schemas";
import { ManualSourcesService } from "../manual-sources/service";
import { OverridesService } from "../overrides/service";

@Injectable()
export class GamesService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
    private readonly manualSources: ManualSourcesService,
    private readonly overrides: OverridesService,
  ) {}

  private gamesCol() {
    return this.db.collection("games");
  }

  async createGame(
    game: Game,
    ctx: { actorId: string; reason?: string; request?: any },
  ) {
    const now = new Date().toISOString();

    // validate input shape
    const parsed = GameSchema.safeParse(game);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const doc = {
      ...parsed.data,
      createdAt: now,
      updatedAt: now,
      lastIngestedAt: undefined,
    };

    await this.gamesCol().insertOne(doc);

    await this.audit.append({
      at: now,
      actor: { type: "admin", id: ctx.actorId },
      action: "game.create",
      entity: { type: "game", id: doc.id },
      reason: ctx.reason,
      after: { id: doc.id, name: doc.name },
      request: ctx.request,
    });

    return doc;
  }

  async patchCanonicalGame(
    id: string,
    patch: Partial<Game>,
    ctx: { actorId: string; reason?: string; request?: any },
  ) {
    const now = new Date().toISOString();
    const before = await this.gamesCol().findOne({ id });
    if (!before) throw new NotFoundException("Game not found");

    const afterCandidate = {
      ...before,
      ...patch,
      id: before.id, // protect id
      updatedAt: now,
    };

    const parsed = GameSchema.safeParse(afterCandidate);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    await this.gamesCol().updateOne(
      { id },
      { $set: { ...patch, updatedAt: now } },
    );

    await this.audit.append({
      at: now,
      actor: { type: "admin", id: ctx.actorId },
      action: "game.patch",
      entity: { type: "game", id },
      reason: ctx.reason,
      patch,
      request: ctx.request,
    });

    return this.gamesCol().findOne({ id });
  }

  async getComposedById(id: string): Promise<Game | null> {
    const base = await this.gamesCol().findOne({ id });
    if (!base) return null;

    // apply manual sources
    const manualSources = await this.manualSources.listByGameId(id);
    const withSources = applyManualSources(
      base as any,
      manualSources.map((x) => x.source),
      manualSources,
    );

    // apply override (if enabled)
    const override = await this.overrides.getEnabledForGame(id);
    const composed = override
      ? deepMerge(withSources, override.patch)
      : withSources;

    // recompute derived availability (simple rule)
    composed.availability = deriveAvailability(composed);

    // validate final (defensive)
    const parsed = GameSchema.safeParse(composed);
    if (!parsed.success) {
      // If this happens, your manual override/patch broke invariants.
      // You may prefer to throw, or return base + error.
      throw new BadRequestException({
        message: "Composed game failed validation (check manual override).",
        issues: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }

  async listComposed(params: {
    platform?: string;
    categoryType?: string;
    availability?: string;
    limit?: number;
  }): Promise<Game[]> {
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);

    const filter: any = {};
    if (params.platform) filter.platforms = params.platform;
    if (params.categoryType) filter["category.type"] = params.categoryType;
    if (params.availability) filter.availability = params.availability;

    const docs = await this.gamesCol()
      .find(filter)
      .sort({ updatedAt: -1 })
      .limit(limit)
      .toArray();

    // compose each (manual sources + overrides)
    // For small N (<=200), this is fine. Later you can batch-load overrides/sources.
    const out: Game[] = [];
    for (const d of docs) {
      out.push((await this.getComposedById((d as any).id))!);
    }
    return out;
  }

  // Used by ingestion later
  async upsertFromIngestion(game: Game, ctx: { connector: string }) {
    const now = new Date().toISOString();

    const parsed = GameSchema.safeParse(game);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const existing = await this.gamesCol().findOne({ id: parsed.data.id });

    if (!existing) {
      await this.gamesCol().insertOne({
        ...parsed.data,
        createdAt: now,
        updatedAt: now,
        lastIngestedAt: now,
        ingest: { connectors: [ctx.connector] },
      });

      await this.audit.append({
        at: now,
        actor: { type: "system", id: "ingestion" },
        action: "ingest.upsert",
        entity: { type: "game", id: parsed.data.id },
        after: { id: parsed.data.id, name: parsed.data.name },
        changedPaths: ["(new)"],
      });
      return;
    }

    // naive change detection (improve later)
    const patch: any = { ...parsed.data, updatedAt: now, lastIngestedAt: now };
    delete patch.id;
    delete patch.createdAt;

    await this.gamesCol().updateOne(
      { id: parsed.data.id },
      {
        $set: patch,
        $addToSet: { "ingest.connectors": ctx.connector },
      },
    );

    await this.audit.append({
      at: now,
      actor: { type: "system", id: "ingestion" },
      action: "ingest.upsert",
      entity: { type: "game", id: parsed.data.id },
      changedPaths: Object.keys(patch),
    });
  }
}

function deriveAvailability(g: any): "upcoming" | "released" | "unknown" {
  if (g?.release?.status === "released") return "released";
  if (
    g?.release?.status === "upcoming" ||
    g?.release?.status === "announced" ||
    g?.release?.status === "delayed"
  ) {
    return "upcoming";
  }
  return "unknown";
}

// Dedup + attach manual sources
function applyManualSources(
  base: any,
  manualSources: any[],
  manualLinks: any[],
) {
  const existingUrls = new Set<string>(
    (base.sources ?? []).map((s: any) => s.url),
  );
  const mergedSources = [...(base.sources ?? [])];

  for (const s of manualSources) {
    if (!existingUrls.has(s.url)) {
      mergedSources.push(s);
      existingUrls.add(s.url);
    }
  }

  // Optional: scope manual sources into release / seasonWindow
  const releaseSources = [...(base.release?.sources ?? [])];
  const releaseUrls = new Set<string>(releaseSources.map((s: any) => s.url));

  const seasonSources = [...(base.seasonWindow?.current?.sources ?? [])];
  const seasonUrls = new Set<string>(seasonSources.map((s: any) => s.url));

  for (const link of manualLinks) {
    const s = link.source;
    if (link.scope === "release") {
      if (!releaseUrls.has(s.url)) {
        releaseSources.push(s);
        releaseUrls.add(s.url);
      }
    } else if (link.scope === "seasonWindow") {
      if (!seasonUrls.has(s.url)) {
        seasonSources.push(s);
        seasonUrls.add(s.url);
      }
    }
  }

  const out = { ...base, sources: mergedSources };
  if (out.release) out.release = { ...out.release, sources: releaseSources };
  if (out.seasonWindow?.current) {
    out.seasonWindow = {
      ...out.seasonWindow,
      current: { ...out.seasonWindow.current, sources: seasonSources },
    };
  }
  return out;
}

// Simple deep merge (objects only; arrays replaced)
function deepMerge(a: any, b: any): any {
  if (b === null || b === undefined) return a;
  if (Array.isArray(b)) return b.slice();
  if (typeof b !== "object") return b;
  if (typeof a !== "object" || a === null || Array.isArray(a)) return { ...b };

  const out: any = { ...a };
  for (const k of Object.keys(b)) {
    out[k] = deepMerge(a[k], b[k]);
  }
  return out;
}
