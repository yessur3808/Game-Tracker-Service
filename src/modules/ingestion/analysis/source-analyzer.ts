/**
 * Source scoring, reliability assessment, and confidence grading.
 *
 * Each ingested source is evaluated against a set of heuristics to
 * determine how much weight its data should carry during merging.
 */

import { ProviderResult } from "../providers/types";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type SourceReliability = "high" | "medium" | "low" | "unknown";
export type SourceConfidence = "official" | "likely" | "rumor" | "unknown";

export type SourceScore = {
  reliability: SourceReliability;
  confidence: SourceConfidence;
  isOfficial: boolean;
  /** 1 – 100 numeric score for sorting / tie-breaking */
  numericScore: number;
  /** Human-readable reasons contributing to the score */
  reasons: string[];
};

/* ------------------------------------------------------------------ */
/*  Provider tier mapping                                              */
/* ------------------------------------------------------------------ */

const PROVIDER_BASE_SCORES: Record<string, number> = {
  steam: 90,
  igdb: 80,
  playstation: 85,
  xbox: 83,
  nintendo: 82,
  epic: 72,
};

const OFFICIAL_PROVIDERS = new Set([
  "steam",
  "playstation",
  "xbox",
  "nintendo",
  "epic",
]);

/* ------------------------------------------------------------------ */
/*  Domain-based reliability                                           */
/* ------------------------------------------------------------------ */

const HIGH_RELIABILITY_DOMAINS = [
  "steampowered.com",
  "store.steampowered.com",
  "playstation.com",
  "store.playstation.com",
  "xbox.com",
  "microsoft.com",
  "nintendo.com",
  "epicgames.com",
  "store.epicgames.com",
  "igdb.com",
];

const MEDIUM_RELIABILITY_DOMAINS = [
  "ign.com",
  "gamespot.com",
  "kotaku.com",
  "polygon.com",
  "eurogamer.net",
  "gamesradar.com",
  "destructoid.com",
  "pcgamer.com",
  "rockpapershotgun.com",
  "theverge.com",
  "gematsu.com",
  "pushsquare.com",
  "nintendolife.com",
  "purexbox.com",
];

function domainReliability(url?: string): SourceReliability {
  if (!url) return "unknown";
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (HIGH_RELIABILITY_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))) {
      return "high";
    }
    if (MEDIUM_RELIABILITY_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))) {
      return "medium";
    }
  } catch {
    // invalid URL
  }
  return "unknown";
}

/* ------------------------------------------------------------------ */
/*  Core scoring function                                              */
/* ------------------------------------------------------------------ */

/**
 * Evaluate a provider result and produce a {@link SourceScore}.
 */
export function scoreSource(result: ProviderResult): SourceScore {
  const reasons: string[] = [];
  let numeric = PROVIDER_BASE_SCORES[result.provider] ?? 50;
  const isOfficial = OFFICIAL_PROVIDERS.has(result.provider);

  if (isOfficial) {
    reasons.push(`Official platform provider: ${result.provider}`);
  }

  // Boost for having a release date (structured data is more reliable)
  if (result.releaseDateISO) {
    numeric = Math.min(100, numeric + 5);
    reasons.push("Has structured release date");
  }

  // Boost for name + cover (page was likely parsed successfully)
  if (result.name && result.coverUrl) {
    numeric = Math.min(100, numeric + 5);
    reasons.push("Has both name and cover image");
  }

  // Partial boost for having a name (basic scrape success)
  if (result.name && !result.coverUrl) {
    numeric = Math.min(100, numeric + 2);
    reasons.push("Has game name");
  }

  // Boost for having a description (page was fully parsed)
  if (result.description) {
    numeric = Math.min(100, numeric + 3);
    reasons.push("Has description");
  }

  // Penalty for missing name (likely a broken page or 404)
  if (!result.name) {
    numeric = Math.max(1, numeric - 25);
    reasons.push("Missing game name — possible scrape failure");
  }

  // Domain-level reliability
  const domRel = domainReliability(result.url);
  if (domRel === "high") {
    numeric = Math.min(100, numeric + 3);
    reasons.push("High-reliability domain");
  } else if (domRel === "medium") {
    reasons.push("Medium-reliability domain");
  } else if (domRel === "low") {
    numeric = Math.max(1, numeric - 15);
    reasons.push("Low-reliability domain");
  }

  // Map numeric → categorical reliability
  // Thresholds chosen to align with the 1–100 provider base-score distribution:
  //   ≥75 "high"    — official stores with successful scrapes (base 72–90 + bonuses)
  //   ≥45 "medium"  — known gaming-news domains or degraded official scrapes
  //   ≥20 "low"     — unknown domains with partial data
  //   <20 "unknown"  — broken scrapes or unrecognised sources
  let reliability: SourceReliability;
  if (numeric >= 75) reliability = "high";
  else if (numeric >= 45) reliability = "medium";
  else if (numeric >= 20) reliability = "low";
  else reliability = "unknown";

  // Confidence thresholds:
  //   "official" — official provider with structured release date
  //   "likely"   — official provider without date, or ≥55 from trusted source
  //   "rumor"    — ≥25, non-official with some data
  //   "unknown"  — below 25, insufficient signal
  let confidence: SourceConfidence;
  if (isOfficial && result.releaseDateISO) confidence = "official";
  else if (isOfficial) confidence = "likely";
  else if (numeric >= 55) confidence = "likely";
  else if (numeric >= 25) confidence = "rumor";
  else confidence = "unknown";

  return { reliability, confidence, isOfficial, numericScore: numeric, reasons };
}

/**
 * Given multiple provider results for the same game, returns
 * the best one to use as the primary data source, based on
 * score comparison.
 */
export function pickBestSource(results: ProviderResult[]): ProviderResult | null {
  if (results.length === 0) return null;

  let best = results[0];
  let bestScore = scoreSource(best).numericScore;

  for (let i = 1; i < results.length; i++) {
    const sc = scoreSource(results[i]).numericScore;
    if (sc > bestScore) {
      best = results[i];
      bestScore = sc;
    }
  }
  return best;
}
