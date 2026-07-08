import { Injectable, Logger } from "@nestjs/common";
import { NintendoProvider } from "../providers/nintendo.provider";

export type NintendoUpcomingItem = {
  externalId: string;
  name: string;
};

/**
 * Discovers upcoming games from Nintendo eShop / Switch 2.
 * Note: Currently returns empty array.
 * Future: Scrape store.nintendo.com eShop upcoming + nintendo.com Direct announcements.
 */
@Injectable()
export class NintendoUpcomingService {
  private readonly logger = new Logger(NintendoUpcomingService.name);

  constructor(private readonly nintendo: NintendoProvider) {}

  async fetchUpcoming(_limit: number): Promise<NintendoUpcomingItem[]> {
    // TODO: Implement Nintendo eShop discovery by scraping or Direct RSS parsing
    this.logger.debug("Nintendo discovery not yet implemented");
    return [];
  }
}
