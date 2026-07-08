import { Injectable, Logger } from "@nestjs/common";
import { IgdbProvider } from "../providers/igdb.provider";

export type IgdbUpcomingItem = {
  externalId: number;
  name: string;
};

/**
 * Discovers upcoming games from IGDB by querying for games with
 * first_release_date in the future (not yet released).
 */
@Injectable()
export class IgdbUpcomingService {
  private readonly logger = new Logger(IgdbUpcomingService.name);

  constructor(private readonly igdb: IgdbProvider) {}

  /**
   * Fetch upcoming games from IGDB. Returns up to `limit` games
   * sorted by first_release_date (soonest first).
   */
  async fetchUpcoming(limit: number): Promise<IgdbUpcomingItem[]> {
    try {
      const now = Math.floor(Date.now() / 1000); // Unix timestamp

      const q = `
        fields id,name,first_release_date;
        where first_release_date > ${now} & status != 8; -- status 8 = cancelled
        sort first_release_date asc;
        limit ${Math.min(limit, 100)};
      `;

      const arr = await (this.igdb as any).igdbPost("/v4/games", q);
      if (!Array.isArray(arr)) {
        this.logger.warn("IGDB upcoming query returned non-array");
        return [];
      }

      return arr
        .filter((g: any) => g?.id && g?.name)
        .map((g: any) => ({
          externalId: g.id,
          name: g.name,
        }));
    } catch (err: any) {
      this.logger.warn(`IGDB upcoming fetch failed: ${err.message}`);
      return [];
    }
  }
}
