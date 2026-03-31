import { Controller, HttpCode, Post, UseGuards } from "@nestjs/common";
import { AdminGuard } from "../admin/guard";
import { IngestionService } from "./service";

@Controller("/ingest")
@UseGuards(AdminGuard)
export class IngestionController {
  constructor(private readonly ingestion: IngestionService) {}

  /**
   * Trigger a full ingestion run immediately.
   * The run executes in the background; responds 202 as soon as it starts.
   * Check the ingestion_runs collection (or a future status endpoint) for results.
   */
  @Post("run")
  @HttpCode(202)
  triggerRun(): { message: string } {
    void this.ingestion.runBiWeekly().catch((err) => {
      console.error("Ingestion run failed", err);
    });
    return { message: "Ingestion run started" };
  }
}
