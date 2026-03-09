import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { DbModule } from "./db.module";
import { GamesModule } from "./games/module";
import { AdminModule } from "./admin/module";
import { IngestionModule } from "./ingestion/module";
import { HealthModule } from "./health/module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    DbModule,
    GamesModule,
    AdminModule,
    IngestionModule,
    HealthModule,
  ],
})
export class AppModule {}
