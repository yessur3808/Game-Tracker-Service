/**
 * Normalises one or more {@link ProviderResult} objects into a
 * canonical {@link Game} document that is ready for upserting.
 *
 * The normaliser:
 * - Parses raw release-date text into structured ISO dates
 * - Derives `release.status`, `confidence`, `datePrecision`
 * - Maps provider-specific platform strings to a canonical set
 * - Scores and attaches source metadata
 * - Picks the best data when multiple providers disagree
 */

import { Game, Source, Release } from "../../../shared/types";
import { ProviderResult } from "../providers/types";
import { parseReleaseDate } from "./date-parser";
import { scoreSource } from "./source-analyzer";

/* ------------------------------------------------------------------ */
/*  Platform normalisation                                             */
/* ------------------------------------------------------------------ */

const PLATFORM_MAP: Record<string, string> = {
  // Steam
  pc: "PC",
  windows: "PC",
  win: "PC",
  mac: "Mac",
  macos: "Mac",
  linux: "Linux",
  steamos: "Linux",

  // Console
  ps5: "PS5",
  "playstation 5": "PS5",
  ps4: "PS4",
  "playstation 4": "PS4",
  "xbox series x": "Xbox Series X|S",
  "xbox series s": "Xbox Series X|S",
  "xbox series x|s": "Xbox Series X|S",
  "xbox series x/s": "Xbox Series X|S",
  xboxone: "Xbox One",
  "xbox one": "Xbox One",
  switch: "Nintendo Switch",
  "nintendo switch": "Nintendo Switch",
  "switch 2": "Nintendo Switch 2",
  "nintendo switch 2": "Nintendo Switch 2",

  // Mobile
  ios: "iOS",
  android: "Android",

  // Abbreviations from IGDB
  xone: "Xbox One",
  xsx: "Xbox Series X|S",
  ns: "Nintendo Switch",
};

function normalizePlatform(raw: string): string {
  const key = raw.toLowerCase().trim();
  return PLATFORM_MAP[key] ?? raw;
}

function normalizePlatforms(raw: string[] | undefined): string[] {
  if (!raw || raw.length === 0) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of raw) {
    const n = normalizePlatform(p);
    if (!seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Single-result → Game mapping                                       */
/* ------------------------------------------------------------------ */

/**
 * Convert a single {@link ProviderResult} into a partial {@link Game}.
 * The returned Game has all required fields filled in (with safe defaults
 * where the provider didn't supply data).
 */
export function normalizeProviderResult(
  result: ProviderResult,
  gameId: string,
): Game {
  const score = scoreSource(result);
  const parsed = parseReleaseDate(
    result.releaseDateISO ?? result.releaseText,
  );

  const source: Source = {
    type: "platform_store",
    name: result.provider,
    url: result.url,
    isOfficial: score.isOfficial,
    reliability: score.reliability,
    retrievedAt: result.fetchedAt,
    credibilityScore: score.numericScore,
  };

  const release: Release = buildRelease(parsed, score, source);

  return {
    id: gameId,
    name: result.name ?? gameId,
    category: { type: "full_game" },
    platforms: normalizePlatforms(result.platforms),
    availability: deriveAvailabilityFromRelease(release),
    release,
    coverUrl: result.coverUrl ?? undefined,
    sources: [source],
    updatedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/*  Multi-result merging                                               */
/* ------------------------------------------------------------------ */

/**
 * Given multiple provider results for the same game, merge them into
 * one canonical {@link Game} document. Higher-scored sources take
 * precedence for conflicting scalar fields; arrays are unioned.
 */
export function mergeProviderResults(
  results: ProviderResult[],
  gameId: string,
): Game {
  if (results.length === 0) {
    throw new Error("mergeProviderResults requires at least one result");
  }
  if (results.length === 1) return normalizeProviderResult(results[0], gameId);

  // Sort by score descending (best first)
  const scored = results
    .map((r) => ({ result: r, score: scoreSource(r) }))
    .sort((a, b) => b.score.numericScore - a.score.numericScore);

  const primary = scored[0];
  const base = normalizeProviderResult(primary.result, gameId);

  // Merge sources from all providers
  const seenUrls = new Set(
    base.sources.filter((s) => s.url).map((s) => s.url!),
  );

  for (let i = 1; i < scored.length; i++) {
    const { result, score } = scored[i];
    const src: Source = {
      type: "platform_store",
      name: result.provider,
      url: result.url,
      isOfficial: score.isOfficial,
      reliability: score.reliability,
      retrievedAt: result.fetchedAt,
      credibilityScore: score.numericScore,
    };
    if (!src.url || !seenUrls.has(src.url)) {
      base.sources.push(src);
      if (src.url) seenUrls.add(src.url);
    }

    // Union platforms
    const newPlatforms = normalizePlatforms(result.platforms);
    for (const p of newPlatforms) {
      if (!base.platforms.includes(p)) base.platforms.push(p);
    }

    // Fill missing fields from lower-scored sources
    if (!base.name || base.name === gameId) {
      base.name = result.name ?? base.name;
    }
    if (!base.coverUrl && result.coverUrl) {
      base.coverUrl = result.coverUrl;
    }

    // If primary has no release date but secondary does, take it
    if (!base.release.dateISO && result.releaseDateISO) {
      const parsed = parseReleaseDate(result.releaseDateISO);
      if (parsed.dateISO) {
        base.release.dateISO = parsed.dateISO;
        base.release.datePrecision = parsed.precision;
        base.release.status = "released";
        base.availability = "released";
      }
    }
  }

  return base;
}

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

function buildRelease(
  parsed: ReturnType<typeof parseReleaseDate>,
  score: ReturnType<typeof scoreSource>,
  source: Source,
): Release {
  const release: Release = {
    status: "unknown",
    isOfficial: score.isOfficial,
    confidence: score.confidence,
    sources: [source],
  };

  if (parsed.dateISO) {
    release.dateISO = parsed.dateISO;
    release.datePrecision = parsed.precision;
    // If we have a concrete past date, mark as released
    const d = new Date(parsed.dateISO);
    if (!isNaN(d.getTime()) && d.getTime() <= Date.now()) {
      release.status = "released";
    } else {
      release.status = "upcoming";
    }
  } else if (parsed.precision !== "unknown") {
    release.status = "announced";
    release.datePrecision = parsed.precision;
    release.announced_window = parsed.announcedWindow as any;
  } else {
    release.status = "unknown";
  }

  return release;
}

function deriveAvailabilityFromRelease(
  r: Release,
): "upcoming" | "released" | "cancelled" | "unknown" {
  if (r.status === "released") return "released";
  if (r.status === "canceled") return "cancelled";
  if (
    r.status === "upcoming" ||
    r.status === "announced" ||
    r.status === "delayed" ||
    r.status === "recurring_daily" ||
    r.status === "recurring_weekly"
  ) {
    return "upcoming";
  }
  return "unknown";
}
