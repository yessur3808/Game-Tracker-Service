import { Injectable, Logger } from "@nestjs/common";
import { PlayStationProvider } from "../providers/playstation.provider";

export type PlayStationUpcomingItem = {
  externalId: string;
  name: string;
};

/**
 * Discovers upcoming games from PlayStation Store.
 * Note: Currently returns empty array. 
 * Future: Scrape blog.playstation.com announcements + store.playstation.com upcoming releases.
 */
@Injectable()
export class PlayStationUpcomingService {
  private readonly logger = new Logger(PlayStationUpcomingService.name);

  constructor(private readonly playstation: PlayStationProvider) {}

  async fetchUpcoming(_limit: number): Promise<PlayStationUpcomingItem[]> {
    // TODO: Implement PlayStation Store discovery by scraping blog + store
    this.logger.debug("PlayStation discovery not yet implemented");
    return [];
  }
}
