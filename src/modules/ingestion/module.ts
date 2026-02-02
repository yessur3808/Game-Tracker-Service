import { Module } from "@nestjs/common";
import { IngestionService } from "./service";
import { GamesModule } from "../games/module";

@Module({
  imports: [GamesModule],
  providers: [IngestionService],
})
export class IngestionModule {}
