import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AdminGuard } from "./guard";
import { GamesService } from "../games/service";
import { ManualSourcesService } from "../manual-sources/service";
import { OverridesService } from "../overrides/service";
import { Game } from "../../shared/types";

@Controller("/admin")
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly games: GamesService,
    private readonly manualSources: ManualSourcesService,
    private readonly overrides: OverridesService,
  ) {}

  @Post("/games")
  async createGame(
    @Body() body: { game: Game; reason?: string },
    @Req() req: any,
  ) {
    return this.games.createGame(body.game, {
      actorId: req.adminActorId,
      reason: body.reason,
      request: pickReq(req),
    });
  }

  // NOTE: prefer overrides; this patches canonical directly (still audited)
  @Patch("/games/:id")
  async patchGame(
    @Param("id") id: string,
    @Body() body: { patch: Partial<Game>; reason?: string },
    @Req() req: any,
  ) {
    return this.games.patchCanonicalGame(id, body.patch, {
      actorId: req.adminActorId,
      reason: body.reason,
      request: pickReq(req),
    });
  }

  @Delete("/games/:id")
  async deleteGame(
    @Param("id") id: string,
    @Body() body: { reason?: string },
    @Req() req: any,
  ) {
    return this.games.deleteGame(id, {
      actorId: req.adminActorId,
      reason: body?.reason,
      request: pickReq(req),
    });
  }

  @Get("/games/:id/overrides")
  async listOverrides(@Param("id") id: string) {
    return this.overrides.listByGameId(id);
  }

  @Get("/games/:id/manual-sources")
  async listManualSources(@Param("id") id: string) {
    return this.manualSources.listByGameId(id);
  }
}

function pickReq(req: any) {
  return {
    ip: req.ip,
    userAgent: req.headers?.["user-agent"],
    requestId: req.headers?.["x-request-id"],
  };
}
