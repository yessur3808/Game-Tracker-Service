import { Injectable, Logger } from "@nestjs/common";

export type GematsuRelease = {
  externalId: string; // date-based ID
  name: string;
  dateEstimate: string; // "Q2 2026", "Spring 2026", "April 15, 2026"
};

/**
 * Discovers upcoming games from Gematsu Release Calendar.
 * Parses https://www.gematsu.com/calendar to extract scheduled game releases.
 * Requires cheerio for HTML parsing.
 */
@Injectable()
export class GematsuUpcomingService {
  private readonly logger = new Logger(GematsuUpcomingService.name);
  private readonly calendarUrl = "https://www.gematsu.com/calendar";

  constructor() {}

  async fetchUpcoming(_limit: number): Promise<GematsuRelease[]> {
    try {
      // TODO: Implement Gematsu calendar scraping
      // 1. Fetch https://www.gematsu.com/calendar
      // 2. Parse HTML table rows
      // 3. Extract game title + release date
      // 4. Deduplicate by title (case-insensitive)
      // 5. Return up to limit items with future dates
      this.logger.debug("Gematsu discovery not yet implemented (requires cheerio)");
      return [];
    } catch (error) {
      this.logger.warn(`Gematsu fetch failed: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }
}
