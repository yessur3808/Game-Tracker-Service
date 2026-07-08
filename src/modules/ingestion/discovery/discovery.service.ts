import { Injectable, Logger } from "@nestjs/common";
import { SteamCatalogService } from "./steam-catalog.service";
import { IgdbUpcomingService } from "./igdb-upcoming.service";
import { EpicUpcomingService } from "./epic-upcoming.service";
import { PlayStationUpcomingService } from "./playstation-upcoming.service";
import { XboxUpcomingService } from "./xbox-upcoming.service";
import { NintendoUpcomingService } from "./nintendo-upcoming.service";
import { GematsuUpcomingService } from "./gematsu-upcoming.service";
import { MetacriticUpcomingService } from "./metacritic-upcoming.service";
import { IGNUpcomingService } from "./ign-upcoming.service";
import { GamesRadarUpcomingService } from "./gamesradar-upcoming.service";
import { AdditionalSourcesService } from "./additional-sources.service";
import { SteamProvider } from "../providers/steam.provider";
import { IgdbProvider } from "../providers/igdb.provider";
import { GamesService } from "../../games/service";
import { normalizeProviderResult } from "../analysis/normalizer";

export type DiscoveryStats = {
  seeded: number;
  skipped: number;
  failed: number;
  total: number;
};

type SourceStats = {
  [source: string]: { seeded: number; skipped: number; failed: number };
};

/**
 * Discovers new upcoming games from multiple sources and seeds them into the database
 * so the refresh pipeline can enrich them.
 *
 * Active Sources:
 *  1. Steam's coming_soon category (public API, no auth)
 *  2. IGDB upcoming releases (requires Twitch OAuth)
 *
 * Tier 1 - Official Store Integrations (framework ready, awaiting API/scraping impl):
 *  3. Epic Games Store
 *  4. PlayStation Store
 *  5. Xbox/Game Pass
 *  6. Nintendo eShop
 *
 * Tier 2 - Gaming Media Scrapers (framework ready, awaiting HTML parsing impl):
 *  7. Gematsu Release Calendar
 *  8. Metacritic Upcoming by Platform
 *  9. IGN Upcoming Games
 *  10. GamesRadar+ Upcoming
 *
 * Additional source registry:
 *  Registered sources include major media, stores, publisher pages, and event hubs
 *  (PlayStation Blog, Xbox Wire, Nintendo Direct recaps, GameSpot, PC Gamer,
 *  Eurogamer, Polygon, VG247, Destructoid, Kotaku, GOG, Humble, itch.io,
 *  Ubisoft/EA/Bandai Namco/Square Enix/Capcom official pages, Push Square,
 *  TrueTrophies, TrueAchievements, Nintendo Life, Gamescom, Summer Game Fest, etc.).
 */
@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);

  /** Guards against concurrent runs triggered by overlapping cron ticks */
  private isRunning = false;

  constructor(
    private readonly steamCatalog: SteamCatalogService,
    private readonly igdbUpcoming: IgdbUpcomingService,
    private readonly epicUpcoming: EpicUpcomingService,
    private readonly playstationUpcoming: PlayStationUpcomingService,
    private readonly xboxUpcoming: XboxUpcomingService,
    private readonly nintendoUpcoming: NintendoUpcomingService,
    private readonly gematsuUpcoming: GematsuUpcomingService,
    private readonly metacriticUpcoming: MetacriticUpcomingService,
    private readonly ignUpcoming: IGNUpcomingService,
    private readonly gamesRadarUpcoming: GamesRadarUpcomingService,
    private readonly additionalSources: AdditionalSourcesService,
    private readonly steam: SteamProvider,
    private readonly igdb: IgdbProvider,
    private readonly games: GamesService,
  ) {}

  async runDiscovery(limit = 200): Promise<DiscoveryStats> {
    if (this.isRunning) {
      this.logger.warn("Discovery skipped — previous run still in progress");
      return { seeded: 0, skipped: 0, failed: 0, total: 0 };
    }

    this.isRunning = true;
    const sourceStats: SourceStats = {};
    const aggregated: DiscoveryStats = { seeded: 0, skipped: 0, failed: 0, total: 0 };

    try {
      // Orchestrate discovery from all available sources
      const sources: Array<{
        name: string;
        fetch: () => Promise<Array<{ externalId: number | string; name: string; provider: string }>>;
      }> = [
        {
          name: "Steam",
          fetch: async () => {
            const items = await this.steamCatalog.fetchCategories(limit);
            return items.map((i) => ({ externalId: i.appId, name: i.name, provider: "steam" }));
          },
        },
        {
          name: "IGDB",
          fetch: async () => {
            const items = await this.igdbUpcoming.fetchUpcoming(Math.floor(limit * 0.5));
            return items.map((i) => ({ externalId: i.externalId, name: i.name, provider: "igdb" }));
          },
        },
        {
          name: "Epic Games",
          fetch: async () => {
            const items = await this.epicUpcoming.fetchUpcoming(Math.floor(limit * 0.3));
            return items.map((i) => ({ externalId: i.externalId, name: i.name, provider: "epic" }));
          },
        },
        {
          name: "PlayStation Store",
          fetch: async () => {
            const items = await this.playstationUpcoming.fetchUpcoming(Math.floor(limit * 0.3));
            return items.map((i) => ({ externalId: i.externalId, name: i.name, provider: "playstation" }));
          },
        },
        {
          name: "Xbox Store",
          fetch: async () => {
            const items = await this.xboxUpcoming.fetchUpcoming(Math.floor(limit * 0.3));
            return items.map((i) => ({ externalId: i.externalId, name: i.name, provider: "xbox" }));
          },
        },
        {
          name: "Nintendo eShop",
          fetch: async () => {
            const items = await this.nintendoUpcoming.fetchUpcoming(Math.floor(limit * 0.3));
            return items.map((i) => ({ externalId: i.externalId, name: i.name, provider: "nintendo" }));
          },
        },
        {
          name: "Gematsu",
          fetch: async () => {
            const items = await this.gematsuUpcoming.fetchUpcoming(Math.floor(limit * 0.2));
            return items.map((i) => ({ externalId: i.externalId, name: i.name, provider: "gematsu" }));
          },
        },
        {
          name: "Metacritic",
          fetch: async () => {
            const items = await this.metacriticUpcoming.fetchUpcoming(Math.floor(limit * 0.2));
            return items.map((i) => ({ externalId: i.externalId, name: i.name, provider: "metacritic" }));
          },
        },
        {
          name: "IGN",
          fetch: async () => {
            const items = await this.ignUpcoming.fetchUpcoming(Math.floor(limit * 0.2));
            return items.map((i) => ({ externalId: i.externalId, name: i.name, provider: "ign" }));
          },
        },
        {
          name: "GamesRadar+",
          fetch: async () => {
            const items = await this.gamesRadarUpcoming.fetchUpcoming(Math.floor(limit * 0.2));
            return items.map((i) => ({ externalId: i.externalId, name: i.name, provider: "gamesradar" }));
          },
        },
      ];

      // Register and run additional configured sources from the central registry.
      const configured = this.additionalSources.getConfiguredSources();
      const extraLimit = Math.max(1, Math.floor(limit * 0.1));
      sources.push(
        ...configured.map((src) => ({
          name: src.name,
          fetch: async () => {
            const items = await this.additionalSources.fetchUpcoming(src.provider, extraLimit);
            return items.map((i) => ({ externalId: i.externalId, name: i.name, provider: src.provider }));
          },
        })),
      );

      for (const source of sources) {
        try {
          const items = await source.fetch();
          sourceStats[source.name] = { seeded: 0, skipped: 0, failed: 0 };
          this.logger.log(`Discovery fetched ${items.length} item(s) from ${source.name}`);
          aggregated.total += items.length;

          const CONCURRENCY = 3;
          for (let i = 0; i < items.length; i += CONCURRENCY) {
            const batch = items.slice(i, i + CONCURRENCY);
            const results = await Promise.allSettled(
              batch.map((item) =>
                this.seedGame(item.provider, item.externalId as any, item.name),
              ),
            );
            for (const r of results) {
              if (r.status === "fulfilled") {
                if (r.value === "seeded") {
                  sourceStats[source.name].seeded++;
                  aggregated.seeded++;
                } else {
                  sourceStats[source.name].skipped++;
                  aggregated.skipped++;
                }
              } else {
                sourceStats[source.name].failed++;
                aggregated.failed++;
                this.logger.warn(`Discovery (${source.name}): seed failed — ${r.reason}`);
              }
            }
            // Small yield between batches to avoid hammering APIs
            if (i + CONCURRENCY < items.length) {
              await new Promise((r) => setTimeout(r, 250));
            }
          }
        } catch (err: any) {
          this.logger.warn(`Discovery source ${source.name} failed: ${err.message}`);
        }
      }

      // Log per-source stats
      for (const [source, stats] of Object.entries(sourceStats)) {
        this.logger.log(
          `  ${source}: ${stats.seeded} seeded, ${stats.skipped} skipped, ${stats.failed} failed`,
        );
      }
    } finally {
      this.isRunning = false;
    }

    return aggregated;
  }

  private async seedGame(
    provider: string,
    externalId: number | string,
    fallbackName: string,
  ): Promise<"seeded" | "skipped"> {
    const existing = await this.games.findByExternalId(provider, externalId);
    if (existing) return "skipped";

    const gameId = `${provider}-${externalId}`;
    let result: any;

    // Fetch full metadata based on provider
    if (provider === "steam") {
      result = await this.steam.fetchNormalized(externalId as number);
    } else if (provider === "igdb") {
      result = await this.igdb.fetchNormalizedById(externalId as number);
    } else {
      // For epic, playstation, xbox, nintendo, gematsu, metacritic, ign, gamesradar:
      // These sources are not yet fully implemented or don't have fetch methods.
      // Use fallback name only. Once implementation is complete, fetch metadata here.
      result = {
        name: fallbackName,
        availability: "unknown",
        platforms: [],
      };
    }

    const game: any = {
      ...normalizeProviderResult(result, gameId),
      externalIds: { [provider]: externalId },
    };

    // Fallback to catalog name if provider returned nothing
    if (!game.name || game.name === gameId) {
      game.name = fallbackName;
    }

    // Only store games that have not been released yet.
    if (game.availability === "released") {
      this.logger.debug(`Skipped (already released): "${game.name}" (${gameId})`);
      return "skipped";
    }

    await this.games.upsertFromIngestion(game, { connector: `${provider}-discovery` });
    this.logger.log(`Seeded upcoming [${provider}]: "${game.name}" (${gameId})`);
    return "seeded";
  }
}
