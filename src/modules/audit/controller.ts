import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AuditService } from "./service";
import { AdminGuard } from "../admin/guard";

@Controller("/admin/audit")
@UseGuards(AdminGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  async getAudit(
    @Query("entityType") entityType?: string,
    @Query("entityId") entityId?: string,
    @Query("limit") limit?: string,
  ) {
    return this.audit.query({
      entityType,
      entityId,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
