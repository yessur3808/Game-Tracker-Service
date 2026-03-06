import { Module } from "@nestjs/common";
import { IngestionService } from "./service";
import { GamesModule } from "../games/module";
import { ProvidersModule } from "./providers/providers.module";

@Module({
  imports: [GamesModule, ProvidersModule],
  providers: [IngestionService],
})
export class IngestionModule {}
