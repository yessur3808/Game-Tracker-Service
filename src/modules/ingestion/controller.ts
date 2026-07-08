import { Controller, HttpCode, Logger, Post, UseGuards } from "@nestjs/common";
import { AdminGuard } from "../admin/guard";
import { IngestionService } from "./service";
import { DiscoveryService } from "./discovery/discovery.service";

@Controller("/ingest")
@UseGuards(AdminGuard)
export class IngestionController {
  private readonly logger = new Logger(IngestionController.name);

  constructor(
    private readonly ingestion: IngestionService,
    private readonly discovery: DiscoveryService,
  ) {}

  /**
   * Trigger a full refresh ingestion run immediately (enriches existing games).
   * Responds 202; run executes in the background.
   */
  @Post("run")
  @HttpCode(202)
  triggerRun(): { message: string } {
    this.logger.log("Manual ingestion run triggered");
    void this.ingestion.runBiWeekly().catch((err) => {
      this.logger.error(
        "Background ingestion run failed",
        err instanceof Error ? err.stack : String(err),
      );
    });
    return { message: "Ingestion run started" };
  }

  /**
   * Trigger a discovery run immediately (seeds new games from Steam catalog).
   * Responds 202; run executes in the background.
   */
  @Post("discover")
  @HttpCode(202)
  triggerDiscover(): { message: string } {
    this.logger.log("Manual discovery run triggered");
    void this.discovery.runDiscovery(200).then((stats) => {
      this.logger.log(
        `Manual discovery complete — ${stats.seeded} seeded, ${stats.skipped} skipped, ${stats.failed} failed`,
      );
    }).catch((err) => {
      this.logger.error(
        "Background discovery run failed",
        err instanceof Error ? err.stack : String(err),
      );
    });
    return { message: "Discovery run started" };
  }
}
