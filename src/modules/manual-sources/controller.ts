import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AdminGuard } from "../admin/guard";
import { ManualSourcesService } from "./service";
import { Source } from "../../shared/types";

@Controller("/admin")
@UseGuards(AdminGuard)
export class ManualSourcesController {
  constructor(private readonly service: ManualSourcesService) {}

  @Post("/games/:id/manual-sources")
  async create(
    @Param("id") gameId: string,
    @Body()
    body: {
      source: Source;
      scope?: "release" | "seasonWindow" | "media" | "general";
      reason?: string;
    },
    @Req() req: any,
  ) {
    return this.service.create(
      gameId,
      { source: body.source, scope: body.scope },
      {
        actorId: req.adminActorId,
        reason: body.reason,
        request: pickReq(req),
      },
    );
  }

  @Patch("/manual-sources/:sourceId")
  async patch(
    @Param("sourceId") sourceId: string,
    @Body() body: { source?: Source; scope?: string; reason?: string },
    @Req() req: any,
  ) {
    return this.service.patch(sourceId, body, {
      actorId: req.adminActorId,
      reason: body.reason,
      request: pickReq(req),
    });
  }

  @Delete("/manual-sources/:sourceId")
  async del(
    @Param("sourceId") sourceId: string,
    @Body() body: { reason?: string },
    @Req() req: any,
  ) {
    return this.service.delete(sourceId, {
      actorId: req.adminActorId,
      reason: body?.reason,
      request: pickReq(req),
    });
  }
}

function pickReq(req: any) {
  return {
    ip: req.ip,
    userAgent: req.headers?.["user-agent"],
    requestId: req.headers?.["x-request-id"],
  };
}
