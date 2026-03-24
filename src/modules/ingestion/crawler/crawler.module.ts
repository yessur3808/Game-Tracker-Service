import { Module } from "@nestjs/common";
import { SourceFinderService } from "./source-finder";
import { LinkResolverService } from "./link-resolver";
import { ProvidersModule } from "../providers/providers.module";

@Module({
  imports: [ProvidersModule],
  providers: [SourceFinderService, LinkResolverService],
  exports: [SourceFinderService, LinkResolverService],
})
export class CrawlerModule {}
