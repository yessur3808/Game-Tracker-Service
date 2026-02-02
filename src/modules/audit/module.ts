import { Module } from "@nestjs/common";
import { AuditService } from "./service";
import { AuditController } from "./controller";

@Module({
  providers: [AuditService],
  controllers: [AuditController],
  exports: [AuditService],
})
export class AuditModule {}
