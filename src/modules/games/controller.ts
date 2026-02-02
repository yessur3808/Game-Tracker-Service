import { Controller, Get, Param, Query } from "@nestjs/common";
import { GamesService } from "./service";

@Controller("/games")
export class GamesController {
  constructor(private readonly games: GamesService) {}

  @Get()
  async list(
    @Query("platform") platform?: string,
    @Query("categoryType") categoryType?: string,
    @Query("availability") availability?: string,
    @Query("limit") limit?: string,
  ) {
    return this.games.listComposed({
      platform,
      categoryType,
      availability,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get("/:id")
  async get(@Param("id") id: string) {
    const g = await this.games.getComposedById(id);
    return g ?? { error: "not_found" };
  }
}
