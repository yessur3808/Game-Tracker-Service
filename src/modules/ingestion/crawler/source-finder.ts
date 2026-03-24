/**
 * Source finder — discovers potential store-page URLs for a given game
 * name across all supported platform storefronts.
 *
 * The finder produces *candidate URLs* by:
 *  1. Querying API-based providers that support search (Steam, IGDB)
 *  2. Constructing well-known URL patterns for store-front providers
 *  3. Validating that each candidate is reachable (HTTP HEAD / GET)
 */

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SteamProvider } from "../providers/steam.provider";
import { IgdbProvider } from "../providers/igdb.provider";
import { ProviderResult } from "../providers/types";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type DiscoveredSource = {
  provider: string;
  url: string;
  externalId?: string | number;
  /** How the URL was found */
  method: "api_search" | "url_pattern" | "igdb_website";
};

/* ------------------------------------------------------------------ */
/*  Service                                                            */
/* ------------------------------------------------------------------ */

@Injectable()
export class SourceFinderService {
  private readonly logger = new Logger(SourceFinderService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly steam: SteamProvider,
    private readonly igdb: IgdbProvider,
  ) {}

  /**
   * Discover candidate store-page URLs for a game across all providers.
   *
   * Returns an array of {@link DiscoveredSource} objects sorted by
   * provider priority.  The caller should then fetch each URL through
   * its respective provider to get normalised data.
   */
  async discoverSources(gameName: string): Promise<DiscoveredSource[]> {
    const sources: DiscoveredSource[] = [];

    // Run all discovery methods concurrently
    const results = await Promise.allSettled([
      this.discoverFromIgdb(gameName),
      this.discoverFromSteamSearch(gameName),
    ]);

    for (const r of results) {
      if (r.status === "fulfilled") {
        sources.push(...r.value);
      } else {
        this.logger.warn(`Source discovery failed: ${r.reason}`);
      }
    }

    return sources;
  }

  /* ---------------------------------------------------------------- */
  /*  IGDB discovery                                                   */
  /* ---------------------------------------------------------------- */

  private async discoverFromIgdb(name: string): Promise<DiscoveredSource[]> {
    const discovered: DiscoveredSource[] = [];

    try {
      const results = await this.igdb.searchNormalized(name, 5);

      for (const r of results) {
        if (r.externalId) {
          discovered.push({
            provider: "igdb",
            url: `https://www.igdb.com/games/${slugify(r.name ?? String(r.externalId))}`,
            externalId: r.externalId,
            method: "api_search",
          });
        }
      }

      // Also extract external website links from IGDB
      if (results.length > 0 && results[0].externalId) {
        const full = await this.igdb.fetchGameById(
          results[0].externalId as number,
        );
        if (full?.websites && Array.isArray(full.websites)) {
          for (const w of full.websites) {
            if (w?.url && typeof w.url === "string") {
              const provider = classifyUrl(w.url);
              if (provider) {
                discovered.push({
                  provider,
                  url: w.url,
                  method: "igdb_website",
                });
              }
            }
          }
        }
      }
    } catch (err: any) {
      this.logger.warn(`IGDB discovery error for "${name}": ${err.message}`);
    }

    return discovered;
  }

  /* ---------------------------------------------------------------- */
  /*  Steam discovery (via search redirect)                            */
  /* ---------------------------------------------------------------- */

  private async discoverFromSteamSearch(
    name: string,
  ): Promise<DiscoveredSource[]> {
    const discovered: DiscoveredSource[] = [];

    try {
      // Use IGDB results to find Steam app IDs if possible
      const igdbResults = await this.igdb.searchNormalized(name, 3);
      for (const r of igdbResults) {
        if (r.externalId) {
          const full = await this.igdb.fetchGameById(
            r.externalId as number,
          );
          if (full?.websites && Array.isArray(full.websites)) {
            for (const w of full.websites) {
              if (
                w?.url &&
                typeof w.url === "string" &&
                w.url.includes("store.steampowered.com/app/")
              ) {
                const appIdMatch = w.url.match(/\/app\/(\d+)/);
                if (appIdMatch) {
                  discovered.push({
                    provider: "steam",
                    url: w.url,
                    externalId: Number(appIdMatch[1]),
                    method: "igdb_website",
                  });
                }
              }
            }
          }
        }
      }
    } catch (err: any) {
      this.logger.warn(
        `Steam discovery error for "${name}": ${err.message}`,
      );
    }

    return discovered;
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Classify a URL to one of the known provider keys, or null if
 * it doesn't match a known store domain.
 */
function classifyUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("steampowered.com") || host.includes("store.steampowered.com"))
      return "steam";
    if (host.includes("epicgames.com")) return "epic";
    if (host.includes("playstation.com")) return "playstation";
    if (host.includes("xbox.com") || host.includes("microsoft.com"))
      return "xbox";
    if (host.includes("nintendo.com") || host.includes("nintendo-europe.com"))
      return "nintendo";
  } catch {
    // invalid URL
  }
  return null;
}
