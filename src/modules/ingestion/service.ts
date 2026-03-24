import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { Db } from "mongodb";
import { DB } from "../db.module";
import { GamesService } from "../games/service";
import { SteamProvider } from "./providers/steam.provider";
import { IgdbProvider } from "./providers/igdb.provider";
import { EpicProvider } from "./providers/epic.provider";
import { PlayStationProvider } from "./providers/playstation.provider";
import { XboxProvider } from "./providers/xbox.provider";
import { NintendoProvider } from "./providers/nintendo.provider";
import { SourceFinderService } from "./crawler/source-finder";
import { ProviderResult } from "./providers/types";
import {
  mergeProviderResults,
  normalizeProviderResult,
} from "./analysis/normalizer";

type IngestionRunStatus = "running" | "completed" | "failed";

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly games: GamesService,
    private readonly steam: SteamProvider,
    private readonly igdb: IgdbProvider,
    private readonly epic: EpicProvider,
    private readonly playstation: PlayStationProvider,
    private readonly xbox: XboxProvider,
    private readonly nintendo: NintendoProvider,
    private readonly sourceFinder: SourceFinderService,
  ) {}

  private runsCol() {
    return this.db.collection("ingestion_runs");
  }

  /**
   * Bi-weekly ingestion cron: 03:00 UTC on 1st and 15th of each month.
   *
   * The pipeline:
   * 1. Loads all games from the DB
   * 2. For each game, fetches data from known sources (externalIds)
   * 3. Discovers new sources for games that lack them
   * 4. Merges provider results and upserts
   * 5. Records the run in ingestion_runs collection
   */
  @Cron("0 3 1,15 * *")
  async runBiWeekly() {
    const runId = await this.startRun();

    try {
      const allGames = await this.db
        .collection("games")
        .find({})
        .project({ id: 1, name: 1, externalIds: 1, sources: 1 })
        .toArray();

      let updated = 0;
      let failed = 0;

      // Process games with a simple concurrency limiter
      const CONCURRENCY = 3;
      for (let i = 0; i < allGames.length; i += CONCURRENCY) {
        const batch = allGames.slice(i, i + CONCURRENCY);
        const results = await Promise.allSettled(
          batch.map((game) => this.ingestGame(game)),
        );
        for (const r of results) {
          if (r.status === "fulfilled" && r.value) updated++;
          else if (r.status === "rejected") {
            failed++;
            this.logger.warn(`Ingestion failed: ${r.reason}`);
          }
        }
      }

      await this.completeRun(runId, "completed", { updated, failed, total: allGames.length });
      this.logger.log(
        `Ingestion complete: ${updated} updated, ${failed} failed, ${allGames.length} total`,
      );
    } catch (err: any) {
      this.logger.error(`Ingestion run failed: ${err.message}`);
      await this.completeRun(runId, "failed", { error: err.message });
    }
  }

  /**
   * Ingest a single game: fetch from known providers, discover new ones,
   * merge, and upsert. Returns true if the game was updated.
   */
  private async ingestGame(game: any): Promise<boolean> {
    const results: ProviderResult[] = [];

    // 1. Fetch from known external IDs
    if (game.externalIds?.steam) {
      try {
        const r = await this.steam.fetchNormalized(game.externalIds.steam);
        results.push(r);
      } catch (err: any) {
        this.logger.warn(
          `Steam fetch failed for ${game.id}: ${err.message}`,
        );
      }
    }

    if (game.externalIds?.igdb) {
      try {
        const r = await this.igdb.fetchNormalizedById(game.externalIds.igdb);
        results.push(r);
      } catch (err: any) {
        this.logger.warn(
          `IGDB fetch failed for ${game.id}: ${err.message}`,
        );
      }
    }

    // 2. Fetch from known source URLs
    for (const src of game.sources ?? []) {
      if (!src.url) continue;
      try {
        const r = await this.fetchFromSourceUrl(src.url);
        if (r) results.push(r);
      } catch (err: any) {
        this.logger.warn(
          `Source URL fetch failed for ${game.id} (${src.url}): ${err.message}`,
        );
      }
    }

    // 3. If no results yet, try discovery
    if (results.length === 0 && game.name) {
      try {
        const discovered = await this.sourceFinder.discoverSources(game.name);
        for (const d of discovered.slice(0, 3)) {
          try {
            const r = await this.fetchFromSourceUrl(d.url);
            if (r) results.push(r);
          } catch {
            // skip failed discovery targets
          }
        }
      } catch (err: any) {
        this.logger.warn(
          `Discovery failed for ${game.id}: ${err.message}`,
        );
      }
    }

    if (results.length === 0) return false;

    // 4. Merge and upsert
    const merged = results.length === 1
      ? normalizeProviderResult(results[0], game.id)
      : mergeProviderResults(results, game.id);

    await this.games.upsertFromIngestion(merged, {
      connector: results.map((r) => r.provider).join("+"),
    });

    return true;
  }

  /**
   * Determine which provider to use for a URL and fetch through it.
   */
  private async fetchFromSourceUrl(
    url: string,
  ): Promise<ProviderResult | null> {
    try {
      const host = new URL(url).hostname.toLowerCase();

      if (host.includes("steampowered.com")) {
        const appIdMatch = url.match(/\/app\/(\d+)/);
        if (appIdMatch) {
          return await this.steam.fetchNormalized(Number(appIdMatch[1]));
        }
      }
      if (host.includes("epicgames.com")) {
        return await this.epic.fetchByUrl(url);
      }
      if (host.includes("playstation.com")) {
        return await this.playstation.fetchByUrl(url);
      }
      if (host.includes("xbox.com") || host.includes("microsoft.com")) {
        return await this.xbox.fetchByUrl(url);
      }
      if (host.includes("nintendo.com") || host.includes("nintendo-europe.com")) {
        return await this.nintendo.fetchByUrl(url);
      }
    } catch {
      // URL parsing failed or provider threw
    }
    return null;
  }

  /* ---------------------------------------------------------------- */
  /*  Run tracking                                                     */
  /* ---------------------------------------------------------------- */

  private async startRun(): Promise<string> {
    const doc = {
      startedAt: new Date().toISOString(),
      status: "running" as IngestionRunStatus,
      stats: {},
    };
    const res = await this.runsCol().insertOne(doc);
    return String(res.insertedId);
  }

  private async completeRun(
    runId: string,
    status: IngestionRunStatus,
    stats: Record<string, any>,
  ) {
    const { ObjectId } = await import("mongodb");
    await this.runsCol().updateOne(
      { _id: new ObjectId(runId) },
      {
        $set: {
          status,
          completedAt: new Date().toISOString(),
          stats,
        },
      },
    );
  }
}
