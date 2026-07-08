import { Module } from "@nestjs/common";
import { IngestionService } from "./service";
import { IngestionController } from "./controller";
import { GamesModule } from "../games/module";
import { ProvidersModule } from "./providers/providers.module";
import { CrawlerModule } from "./crawler/crawler.module";
import { SteamCatalogService } from "./discovery/steam-catalog.service";
import { IgdbUpcomingService } from "./discovery/igdb-upcoming.service";
import { EpicUpcomingService } from "./discovery/epic-upcoming.service";
import { PlayStationUpcomingService } from "./discovery/playstation-upcoming.service";
import { XboxUpcomingService } from "./discovery/xbox-upcoming.service";
import { NintendoUpcomingService } from "./discovery/nintendo-upcoming.service";
import { GematsuUpcomingService } from "./discovery/gematsu-upcoming.service";
import { MetacriticUpcomingService } from "./discovery/metacritic-upcoming.service";
import { IGNUpcomingService } from "./discovery/ign-upcoming.service";
import { GamesRadarUpcomingService } from "./discovery/gamesradar-upcoming.service";
import { AdditionalSourcesService } from "./discovery/additional-sources.service";
import { DiscoveryService } from "./discovery/discovery.service";

@Module({
  imports: [GamesModule, ProvidersModule, CrawlerModule],
  providers: [
    IngestionService,
    SteamCatalogService,
    IgdbUpcomingService,
    EpicUpcomingService,
    PlayStationUpcomingService,
    XboxUpcomingService,
    NintendoUpcomingService,
    GematsuUpcomingService,
    MetacriticUpcomingService,
    IGNUpcomingService,
    GamesRadarUpcomingService,
    AdditionalSourcesService,
    DiscoveryService,
  ],
  controllers: [IngestionController],
})
export class IngestionModule {}
