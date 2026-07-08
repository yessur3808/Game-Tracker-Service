import { Injectable, Logger } from "@nestjs/common";

export type IGNRelease = {
  externalId: string;
  name: string;
  platform: string;
};

/**
 * Discovers upcoming games from IGN.
 * Parses IGN Upcoming Games database.
 * Requires cheerio for HTML parsing.
 */
@Injectable()
export class IGNUpcomingService {
  private readonly logger = new Logger(IGNUpcomingService.name);

  constructor() {}

  async fetchUpcoming(_limit: number): Promise<IGNRelease[]> {
    try {
      // TODO: Implement IGN upcoming games scraping
      // 1. Fetch IGN upcoming games page or API
      // 2. Filter for future release dates
      // 3. Extract title + platform
      // 4. Deduplicate
      // 5. Return up to limit items
      this.logger.debug("IGN discovery not yet implemented");
      return [];
    } catch (error) {
      this.logger.warn(`IGN fetch failed: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }
}
