import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { DbModule } from "./db.module";
import { GamesModule } from "./games/module";
import { AdminModule } from "./admin/module";
import { IngestionModule } from "./ingestion/module";
import { HealthModule } from "./health/module";
import { HttpLoggerMiddleware } from "../shared/http-logger.middleware";

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
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HttpLoggerMiddleware).forRoutes("*");
  }
}
