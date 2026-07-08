import { Injectable, Logger } from "@nestjs/common";

export type GamesRadarRelease = {
  externalId: string;
  name: string;
  dateEstimate: string;
};

/**
 * Discovers upcoming games from GamesRadar+.
 * Parses updated GamesRadar content for upcoming releases.
 * Requires cheerio for HTML parsing.
 */
@Injectable()
export class GamesRadarUpcomingService {
  private readonly logger = new Logger(GamesRadarUpcomingService.name);

  constructor() {}

  async fetchUpcoming(_limit: number): Promise<GamesRadarRelease[]> {
    try {
      // TODO: Implement GamesRadar upcoming games scraping
      // 1. Fetch https://www.gamesradar.com/upcoming-games/
      // 2. Parse game cards with title + date
      // 3. Filter for future releases
      // 4. Deduplicate by title
      // 5. Return up to limit items
      this.logger.debug("GamesRadar discovery not yet implemented");
      return [];
    } catch (error) {
      this.logger.warn(`GamesRadar fetch failed: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }
}
