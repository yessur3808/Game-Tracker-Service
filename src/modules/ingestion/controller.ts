import { Controller, HttpCode, Post } from "@nestjs/common";
import { IngestionService } from "./service";

@Controller("ingest")
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
