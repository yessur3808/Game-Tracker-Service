import { Module } from "@nestjs/common";
import { ManualSourcesService } from "./service";
import { ManualSourcesController } from "./controller";
import { AuditModule } from "../audit/module";

@Module({
  imports: [AuditModule],
  providers: [ManualSourcesService],
  controllers: [ManualSourcesController],
  exports: [ManualSourcesService],
})
export class ManualSourcesModule {}
