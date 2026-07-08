import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { fetchJsonWithRetry } from "../providers/http.util";

export type SteamCatalogItem = {
  appId: number;
  name: string;
};

type SteamFeaturedItem = {
  id: number;
  /** 0 = app, 1 = DLC, 4 = bundle. Only type 0 is a full game. */
  type: number;
  name: string;
};

type SteamFeaturedCategory = {
  id: string;
  name: string;
  items?: SteamFeaturedItem[];
};

type SteamFeaturedCategoriesResponse = Record<string, unknown>;

/**
 * Fetches Steam's public "featured categories" endpoint — no API key required.
 * Produces a deduplicated list of Steam app IDs across:
 *   top_sellers → new_releases → coming_soon → specials
 */
@Injectable()
export class SteamCatalogService {
  private readonly logger = new Logger(SteamCatalogService.name);

  constructor(private readonly config: ConfigService) {}

  private get userAgent() {
    return (
      this.config.get<string>("INGESTION_USER_AGENT") ??
      "GameTrackerBot/1.0 (+contact@example.com)"
    );
  }
  private get timeoutMs() {
    return this.config.get<number>("INGESTION_TIMEOUT_MS") ?? 12_000;
  }
  private get maxRetries() {
    return this.config.get<number>("INGESTION_MAX_RETRIES") ?? 2;
  }

  /**
   * Fetch up to `limit` Steam catalog items, deduplicated and ordered by
   * category priority: top sellers → new releases → coming soon → specials.
   */
  async fetchCategories(limit: number): Promise<SteamCatalogItem[]> {
    const cc = this.config.get<string>("DEFAULT_STORE_REGION") ?? "us";
    const l = this.config.get<string>("DEFAULT_STORE_LANGUAGE") ?? "en";
    const url = `https://store.steampowered.com/api/featuredcategories?cc=${encodeURIComponent(cc)}&l=${encodeURIComponent(l)}`;

    const json = await fetchJsonWithRetry<SteamFeaturedCategoriesResponse>(
      url,
      {
        timeoutMs: this.timeoutMs,
        maxRetries: this.maxRetries,
        headers: {
          "User-Agent": this.userAgent,
          Accept: "application/json",
        },
      },
      this.logger,
    );

    // Only seed games that have not yet been released
    const CATEGORY_PRIORITY = ["coming_soon"];

    const seen = new Set<number>();
    const out: SteamCatalogItem[] = [];

    for (const catKey of CATEGORY_PRIORITY) {
      const cat = json[catKey] as SteamFeaturedCategory | undefined;
      const items = cat?.items;
      if (!Array.isArray(items)) continue;

      for (const item of items) {
        // type 0 = full game; skip DLC (1), bundles (4), etc.
        if (!item?.id || item.type !== 0) continue;
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        out.push({ appId: item.id, name: item.name ?? String(item.id) });
        if (out.length >= limit) return out;
      }
    }

    return out;
  }
}
