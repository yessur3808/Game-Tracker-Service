import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // so you don't re-import everywhere
    }),
  ],
})
export class AppModule {}
