import {
  Body,
  Controller,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AdminGuard } from "../admin/guard";
import { OverridesService } from "./service";
import { Game } from "../../shared/types";

@Controller("/admin")
@UseGuards(AdminGuard)
export class OverridesController {
  constructor(private readonly overrides: OverridesService) {}

  @Post("/games/:id/overrides")
  async create(
    @Param("id") gameId: string,
    @Body() body: { patch: Partial<Game>; enabled?: boolean; reason?: string },
    @Req() req: any,
  ) {
    return this.overrides.createForGame(gameId, body, {
      actorId: req.adminActorId,
      request: pickReq(req),
    });
  }

  @Patch("/overrides/:overrideId")
  async patch(
    @Param("overrideId") overrideId: string,
    @Body() body: { patch?: Partial<Game>; enabled?: boolean; reason?: string },
    @Req() req: any,
  ) {
    return this.overrides.patchOverride(overrideId, body, {
      actorId: req.adminActorId,
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
