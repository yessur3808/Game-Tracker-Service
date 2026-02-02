import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { GamesService } from "../games/service";

// Bi-weekly: every 14 days at 03:00 UTC (approx; cron doesn't do "every 14 days" perfectly)
// We'll approximate with "1st and 15th of month" as a starting point.
// Later, use a queue + lastRunAt logic for true bi-weekly cadence.
@Injectable()
export class IngestionService {
  constructor(private readonly games: GamesService) {}

  @Cron("0 3 1,15 * *") // 03:00 UTC on 1st and 15th
  async runBiWeekly() {
    // TODO: implement connectors + normalization
    // Example: upsert a placeholder to prove plumbing works.
    // Remove this after you add real scrapers.
    const sample = {
      id: "sample-game",
      name: "Sample Game",
      category: { type: "full_game" as const },
      platforms: ["PC"],
      availability: "upcoming" as const,
      release: {
        status: "announced" as const,
        isOfficial: false,
        confidence: "likely" as const,
        sources: [],
      },
      sources: [],
    };

    await this.games.upsertFromIngestion(sample as any, {
      connector: "sample",
    });
  }
}
