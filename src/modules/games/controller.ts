import {
  Controller,
  Get,
  Header,
  Headers,
  NotFoundException,
  Param,
  Query,
  Res,
} from "@nestjs/common";
import { Response } from "express";
import { GamesService } from "./service";
import { SCHEMA_VERSION } from "../../shared/version";
import { createHash } from "crypto";

function parseQueryLimit(raw: string | undefined): number | undefined {
  if (raw === undefined || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Parse a comma-separated `fields` query parameter into a projection
 * set.  Returns `null` when no projection was requested (return all).
 */
function parseFields(raw: string | undefined): Set<string> | null {
  if (!raw?.trim()) return null;
  const allowed = new Set([
    "id",
    "name",
    "title",
    "description",
    "category",
    "platforms",
    "availability",
    "release",
    "seasonWindow",
    "studio",
    "media",
    "coverUrl",
    "popularityTier",
    "popularityRank",
    "tags",
    "genres",
    "sources",
    "externalIds",
    "updatedAt",
  ]);
  const requested = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const out = new Set<string>();
  for (const f of requested) {
    if (allowed.has(f)) out.add(f);
  }
  // Always include id
  out.add("id");
  return out.size > 0 ? out : null;
}

function projectGame(game: any, fields: Set<string> | null): any {
  if (!fields) return game;
  const out: any = {};
  for (const f of fields) {
    if (f in game) out[f] = game[f];
  }
  return out;
}

/** Compute a weak ETag from a JSON payload with deterministic key ordering */
function computeETag(body: unknown): string {
  const hash = createHash("md5")
    .update(stableStringify(body))
    .digest("hex")
    .slice(0, 16);
  return `W/"${hash}"`;
}

/** JSON.stringify with sorted keys for deterministic output */
function stableStringify(obj: unknown): string {
  return JSON.stringify(obj, (_key, value) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return Object.keys(value)
        .sort()
        .reduce<Record<string, unknown>>((sorted, k) => {
          sorted[k] = value[k];
          return sorted;
        }, {});
    }
    return value;
  });
}

@Controller("/games")
export class GamesController {
  constructor(private readonly games: GamesService) {}

  @Get()
  @Header("Cache-Control", "public, max-age=60, stale-while-revalidate=30")
  async list(
    @Query("platform") platform?: string,
    @Query("categoryType") categoryType?: string,
    @Query("availability") availability?: string,
    @Query("limit") limit?: string,
    @Query("skip") skip?: string,
    @Query("sortBy") sortBy?: string,
    @Query("fields") fields?: string,
    @Headers("if-none-match") ifNoneMatch?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const parsedLimit = parseQueryLimit(limit);
    const parsedSkip = parseQueryLimit(skip);
    const fieldSet = parseFields(fields);

    const { games, totalCount } = await this.games.listComposed({
      platform,
      categoryType,
      availability,
      limit: parsedLimit,
      skip: parsedSkip,
      sortBy: sortBy as any,
    });

    const projected = games.map((g) => projectGame(g, fieldSet));

    const body = {
      generatedAt: new Date().toISOString(),
      schemaVersion: SCHEMA_VERSION,
      games: projected,
      pagination: {
        skip: parsedSkip ?? 0,
        limit: parsedLimit ?? 50,
        count: games.length,
        totalCount,
      },
    };

    const etag = computeETag(body);
    res?.setHeader("ETag", etag);
    if (ifNoneMatch === etag) {
      res?.status(304);
      return;
    }

    return body;
  }

  @Get("/search")
  async search(
    @Query("q") q?: string,
    @Query("limit") limit?: string,
    @Query("fields") fields?: string,
  ) {
    if (!q?.trim()) return { games: [], totalCount: 0 };
    const fieldSet = parseFields(fields);
    const { games, totalCount } = await this.games.searchByName(q.trim(), {
      limit: parseQueryLimit(limit),
    });
    return {
      games: games.map((g) => projectGame(g, fieldSet)),
      totalCount,
    };
  }

  /** Convenience: upcoming games sorted by release date ascending */
  @Get("/upcoming")
  @Header("Cache-Control", "public, max-age=120, stale-while-revalidate=60")
  async upcoming(
    @Query("limit") limit?: string,
    @Query("skip") skip?: string,
    @Query("fields") fields?: string,
  ) {
    const fieldSet = parseFields(fields);
    const { games, totalCount } = await this.games.listComposed({
      availability: "upcoming",
      limit: parseQueryLimit(limit),
      skip: parseQueryLimit(skip),
      sortBy: "releaseDate",
    });
    return {
      generatedAt: new Date().toISOString(),
      schemaVersion: SCHEMA_VERSION,
      games: games.map((g) => projectGame(g, fieldSet)),
      pagination: {
        count: games.length,
        totalCount,
      },
    };
  }

  /** Convenience: recently released games sorted by release date descending */
  @Get("/recently-released")
  @Header("Cache-Control", "public, max-age=120, stale-while-revalidate=60")
  async recentlyReleased(
    @Query("limit") limit?: string,
    @Query("skip") skip?: string,
    @Query("fields") fields?: string,
  ) {
    const fieldSet = parseFields(fields);
    const { games, totalCount } = await this.games.listComposed({
      availability: "released",
      limit: parseQueryLimit(limit),
      skip: parseQueryLimit(skip),
      sortBy: "releaseDateDesc",
    });
    return {
      generatedAt: new Date().toISOString(),
      schemaVersion: SCHEMA_VERSION,
      games: games.map((g) => projectGame(g, fieldSet)),
      pagination: {
        count: games.length,
        totalCount,
      },
    };
  }

  @Get("/:id")
  async get(@Param("id") id: string, @Query("fields") fields?: string) {
    const g = await this.games.getComposedById(id);
    if (!g) throw new NotFoundException("Game not found");
    return projectGame(g, parseFields(fields));
  }
}
