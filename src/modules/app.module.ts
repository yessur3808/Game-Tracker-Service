import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { ConfigModule } from "./config.module";
import { DbModule } from "./db.module";
import { AuditModule } from "./audit/module";
import { GamesModule } from "./games/module";
import { AdminModule } from "./admin/module";
import { IngestionModule } from "./ingestion/module";

@Module({
  imports: [
    ConfigModule,
    DbModule,
    ScheduleModule.forRoot(),
    AuditModule,
    GamesModule,
    AdminModule,
    IngestionModule,
  ],
})
export class AppModule {}
