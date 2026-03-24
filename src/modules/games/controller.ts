import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Query,
} from "@nestjs/common";
import { GamesService } from "./service";
import { SCHEMA_VERSION } from "../../shared/version";

function parseQueryLimit(raw: string | undefined): number | undefined {
  if (raw === undefined || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

@Controller("/games")
export class GamesController {
  constructor(private readonly games: GamesService) {}

  @Get()
  @Header("Cache-Control", "public, max-age=60, stale-while-revalidate=30")
  async list(
    @Query("platform") platform?: string,
    @Query("categoryType") categoryType?: string,
    @Query("availability") availability?: string,
    @Query("limit") limit?: string,
    @Query("skip") skip?: string,
  ) {
    const parsedLimit = parseQueryLimit(limit);
    const parsedSkip = parseQueryLimit(skip);
    const games = await this.games.listComposed({
      platform,
      categoryType,
      availability,
      limit: parsedLimit,
      skip: parsedSkip,
    });

    return {
      generatedAt: new Date().toISOString(),
      schemaVersion: SCHEMA_VERSION,
      games,
      pagination: {
        skip: parsedSkip ?? 0,
        limit: parsedLimit ?? 50,
        count: games.length,
      },
    };
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
