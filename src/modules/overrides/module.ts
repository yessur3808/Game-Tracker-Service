import { Module } from "@nestjs/common";
import { OverridesService } from "./service";
import { OverridesController } from "./controller";
import { AuditModule } from "../audit/module";

@Module({
  imports: [AuditModule],
  providers: [OverridesService],
  controllers: [OverridesController],
  exports: [OverridesService],
})
export class OverridesModule {}
