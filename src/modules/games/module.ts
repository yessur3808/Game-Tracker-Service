import { Module } from "@nestjs/common";
import { GamesService } from "./service";
import { GamesController } from "./controller";
import { ManualSourcesModule } from "../manual-sources/module";
import { OverridesModule } from "../overrides/module";
import { AuditModule } from "../audit/module";

@Module({
  imports: [ManualSourcesModule, OverridesModule, AuditModule],
  providers: [GamesService],
  controllers: [GamesController],
  exports: [GamesService],
})
export class GamesModule {}
