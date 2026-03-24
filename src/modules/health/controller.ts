import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import { Db } from "mongodb";
import { DB } from "../db.module";

@Controller("/health")
export class HealthController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  check() {
    return { status: "ok", timestamp: new Date().toISOString() };
  }

  @Get("/ready")
  async ready() {
    try {
      await this.db.command({ ping: 1 });
      return { status: "ready", timestamp: new Date().toISOString() };
    } catch (err) {
      throw new ServiceUnavailableException({
        status: "unavailable",
        reason: "MongoDB ping failed",
        timestamp: new Date().toISOString(),
      });
    }
  }
}
