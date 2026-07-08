import { Injectable, Logger } from "@nestjs/common";
import { EpicProvider } from "../providers/epic.provider";

export type EpicUpcomingItem = {
  externalId: string;
  name: string;
};

/**
 * Discovers upcoming games from Epic Games Store.
 * Note: Currently returns empty array as Epic provider doesn't have built-in search.
 * Future: Scrape store.epicgames.com/en-US/browse?category=games or use Epic's public API.
 */
@Injectable()
export class EpicUpcomingService {
  private readonly logger = new Logger(EpicUpcomingService.name);

  constructor(private readonly epic: EpicProvider) {}

  async fetchUpcoming(_limit: number): Promise<EpicUpcomingItem[]> {
    // TODO: Implement Epic Games Store discovery by scraping or API
    this.logger.debug("Epic Games discovery not yet implemented");
    return [];
  }
}
