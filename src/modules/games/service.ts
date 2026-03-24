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

    // recompute derived availability
    composed.availability = deriveAvailability(composed);

    // validate final (defensive)
    const parsed = GameSchema.safeParse(composed);
    if (!parsed.success) {
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
    skip?: number;
  }): Promise<Game[]> {
    const rawLimit = params.limit;
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(rawLimit!, 1), 200)
      : 50;
    const skip = Number.isFinite(params.skip) ? Math.max(params.skip!, 0) : 0;

    const filter: any = {};
    if (params.platform) filter.platforms = params.platform;
    if (params.categoryType) filter["category.type"] = params.categoryType;
    if (params.availability) filter.availability = params.availability;

    const docs = await this.gamesCol()
      .find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    return this.batchCompose(docs);
  }

  async searchByName(
    query: string,
    params: { limit?: number } = {},
  ): Promise<Game[]> {
    const rawLimit = params.limit;
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(rawLimit!, 1), 100)
      : 20;
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const docs = await this.gamesCol()
      .find({ name: { $regex: escapedQuery, $options: "i" } })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .toArray();

    return this.batchCompose(docs);
  }

  /**
   * Batch-loads manual sources and overrides for a set of game docs and
   * composes each game in-memory. Reduces DB round-trips from O(3N) to O(3).
   */
  private async batchCompose(docs: any[]): Promise<Game[]> {
    if (docs.length === 0) return [];

    const ids = docs.map((d) => d.id as string);

    // Two queries replace the N+1 pattern: one for manual sources, one for overrides
    const [allManualLinks, allOverrides] = await Promise.all([
      this.db
        .collection("manual_sources")
        .find({ gameId: { $in: ids } })
        .sort({ createdAt: -1 })
        .toArray(),
      this.db
        .collection("manual_overrides")
        .find({ gameId: { $in: ids }, enabled: true })
        .toArray(),
    ]);

    // Group by gameId for O(1) lookup per game
    const manualLinksByGame = new Map<string, any[]>();
    for (const link of allManualLinks) {
      const arr = manualLinksByGame.get(link.gameId) ?? [];
      arr.push(link);
      manualLinksByGame.set(link.gameId, arr);
    }

    const overrideByGame = new Map<string, any>();
    for (const ov of allOverrides) {
      overrideByGame.set(ov.gameId, ov);
    }

    const out: Game[] = [];
    for (const doc of docs) {
      const id = doc.id as string;
      const gameManualLinks = manualLinksByGame.get(id) ?? [];
      const gameOverride = overrideByGame.get(id) ?? null;

      const withSources = applyManualSources(
        doc,
        gameManualLinks.map((x: any) => x.source),
        gameManualLinks,
      );

      const composed = gameOverride
        ? deepMerge(withSources, gameOverride.patch)
        : withSources;

      composed.availability = deriveAvailability(composed);

      const parsed = GameSchema.safeParse(composed);
      if (!parsed.success) {
        throw new BadRequestException({
          message: `Composed game "${id}" failed validation (check manual override).`,
          issues: parsed.error.flatten(),
        });
      }
      out.push(parsed.data);
    }
    return out;
  }

  async deleteGame(
    id: string,
    ctx: { actorId: string; reason?: string; request?: any },
  ) {
    const now = new Date().toISOString();
    const before = await this.gamesCol().findOne({ id });
    if (!before) throw new NotFoundException("Game not found");

    await this.gamesCol().deleteOne({ id });

    await this.audit.append({
      at: now,
      actor: { type: "admin", id: ctx.actorId },
      action: "game.delete",
      entity: { type: "game", id },
      reason: ctx.reason,
      before: { id, name: (before as any).name },
      request: ctx.request,
    });

    return { ok: true };
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

function deriveAvailability(
  g: any,
): "upcoming" | "released" | "cancelled" | "unknown" {
  if (g?.release?.status === "released") return "released";
  if (g?.release?.status === "canceled") return "cancelled";
  if (
    g?.release?.status === "upcoming" ||
    g?.release?.status === "announced" ||
    g?.release?.status === "delayed" ||
    g?.release?.status === "recurring_daily" ||
    g?.release?.status === "recurring_weekly"
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
  // Use url as dedup key; sources without a url are always included
  const existingUrls = new Set<string>(
    (base.sources ?? [])
      .filter((s: any) => s.url != null)
      .map((s: any) => s.url as string),
  );
  const mergedSources = [...(base.sources ?? [])];

  for (const s of manualSources) {
    if (s.url == null || !existingUrls.has(s.url)) {
      mergedSources.push(s);
      if (s.url != null) existingUrls.add(s.url);
    }
  }

  // Optional: scope manual sources into release / seasonWindow
  const releaseSources = [...(base.release?.sources ?? [])];
  const releaseUrls = new Set<string>(
    releaseSources
      .filter((s: any) => s.url != null)
      .map((s: any) => s.url as string),
  );

  const seasonSources = [...(base.seasonWindow?.current?.sources ?? [])];
  const seasonUrls = new Set<string>(
    seasonSources
      .filter((s: any) => s.url != null)
      .map((s: any) => s.url as string),
  );

  for (const link of manualLinks) {
    const s = link.source;
    if (link.scope === "release") {
      if (s.url == null || !releaseUrls.has(s.url)) {
        releaseSources.push(s);
        if (s.url != null) releaseUrls.add(s.url);
      }
    } else if (link.scope === "seasonWindow") {
      if (s.url == null || !seasonUrls.has(s.url)) {
        seasonSources.push(s);
        if (s.url != null) seasonUrls.add(s.url);
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
