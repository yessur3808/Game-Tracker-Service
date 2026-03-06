import { Controller, Get, NotFoundException, Param, Query } from "@nestjs/common";
import { GamesService } from "./service";

function parseQueryLimit(raw: string | undefined): number | undefined {
  if (raw === undefined || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

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
      limit: parseQueryLimit(limit),
    });
  }

  @Get("/search")
  async search(@Query("q") q?: string, @Query("limit") limit?: string) {
    if (!q?.trim()) return [];
    return this.games.searchByName(q.trim(), {
      limit: parseQueryLimit(limit),
    });
  }

  @Get("/:id")
  async get(@Param("id") id: string) {
    const g = await this.games.getComposedById(id);
    if (!g) throw new NotFoundException("Game not found");
    return g;
  }
}
