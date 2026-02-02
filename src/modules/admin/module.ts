import { Module } from "@nestjs/common";
import { AdminController } from "./controller";
import { GamesModule } from "../games/module";
import { ManualSourcesModule } from "../manual-sources/module";
import { OverridesModule } from "../overrides/module";

@Module({
  imports: [GamesModule, ManualSourcesModule, OverridesModule],
  controllers: [AdminController],
})
export class AdminModule {}
