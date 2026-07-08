import { Injectable, Logger } from "@nestjs/common";
import { XboxProvider } from "../providers/xbox.provider";

export type XboxUpcomingItem = {
  externalId: string;
  name: string;
};

/**
 * Discovers upcoming games from Xbox Store / Game Pass.
 * Note: Currently returns empty array.
 * Future: Scrape news.xbox.com "Next Week on Xbox" posts + Xbox Game Pass API.
 */
@Injectable()
export class XboxUpcomingService {
  private readonly logger = new Logger(XboxUpcomingService.name);

  constructor(private readonly xbox: XboxProvider) {}

  async fetchUpcoming(_limit: number): Promise<XboxUpcomingItem[]> {
    // TODO: Implement Xbox Store discovery by scraping news.xbox.com or using Game Pass API
    this.logger.debug("Xbox discovery not yet implemented");
    return [];
  }
}
