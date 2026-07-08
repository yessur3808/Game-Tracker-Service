import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import { Db } from "mongodb";
import { DB } from "../db.module";
import pkg from "../../../package.json";

function formatLocalTime(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("day")}/${get("month")}/${get("year")} - ${get("hour")}:${get("minute")}:${get("second")}`;
}

function baseInfo() {
  const now = new Date();
  return {
    timestamp: now.toISOString(),
    localTime: formatLocalTime(now),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    version: pkg.version,
    environment: process.env.NODE_ENV ?? "development",
    pid: process.pid,
    uptimeSeconds: Math.floor(process.uptime()),
  };
}

@Controller("/health")
export class HealthController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  check() {
    return { status: "ok", ...baseInfo() };
  }

  @Get("/ready")
  async ready() {
    const start = Date.now();
    try {
      await this.db.command({ ping: 1 });
      return {
        status: "ready",
        db: { status: "connected", pingMs: Date.now() - start },
        ...baseInfo(),
      };
    } catch (err) {
      throw new ServiceUnavailableException({
        status: "unavailable",
        reason: "MongoDB ping failed",
        db: { status: "unreachable", pingMs: Date.now() - start },
        ...baseInfo(),
      });
    }
  }
}
