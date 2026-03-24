import { Module } from "@nestjs/common";
import { IngestionService } from "./service";
import { GamesModule } from "../games/module";
import { ProvidersModule } from "./providers/providers.module";
import { CrawlerModule } from "./crawler/crawler.module";

@Module({
  imports: [GamesModule, ProvidersModule, CrawlerModule],
  providers: [IngestionService],
})
export class IngestionModule {}
