import { Injectable, Logger } from "@nestjs/common";

export type MetacriticRelease = {
  externalId: string;
  name: string;
  platform: string; // "pc", "ps5", "xbox-series-x", "switch"
};

/**
 * Discovers upcoming games from Metacritic.
 * Parses https://www.metacritic.com to extract scheduled game releases by platform.
 * Requires cheerio for HTML parsing.
 */
@Injectable()
export class MetacriticUpcomingService {
  private readonly logger = new Logger(MetacriticUpcomingService.name);
  private readonly platforms = [
    "pc",
    "playstation-5",
    "xbox-series-x",
    "nintendo-switch",
  ];

  constructor() {}

  async fetchUpcoming(_limit: number): Promise<MetacriticRelease[]> {
    try {
      // TODO: Implement Metacritic scraping for upcoming games
      // 1. For each platform, fetch https://www.metacritic.com/browse/games/{platform}/releases/
      // 2. Parse game cards (title, release date)
      // 3. Filter for future releases only
      // 4. Deduplicate across platforms
      // 5. Return up to limit items
      this.logger.debug("Metacritic discovery not yet implemented (requires cheerio)");
      return [];
    } catch (error) {
      this.logger.warn(`Metacritic fetch failed: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }
}
