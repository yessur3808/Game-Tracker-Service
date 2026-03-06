import { Inject, Injectable } from "@nestjs/common";
import { Db } from "mongodb";
import { DB } from "../db.module";

export type AuditActor =
  | { type: "admin"; id: string }
  | { type: "system"; id: "ingestion" | "migration" };

export type AuditEvent = {
  at: string;
  actor: AuditActor;
  action:
    | "game.create"
    | "game.patch"
    | "game.delete"
    | "manual_source.create"
    | "manual_source.patch"
    | "manual_source.delete"
    | "override.create"
    | "override.patch"
    | "override.delete"
    | "ingest.upsert";
  entity: { type: "game" | "manual_source" | "override"; id: string };
  reason?: string;
  patch?: any;
  changedPaths?: string[];
  before?: any;
  after?: any;
  request?: { ip?: string; userAgent?: string; requestId?: string };
};

@Injectable()
export class AuditService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async append(evt: AuditEvent) {
    await this.db.collection("audit_log").insertOne({
      ...evt,
      _id: undefined,
    });
  }

  async query(params: {
    entityType?: string;
    entityId?: string;
    limit?: number;
  }) {
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);

    const filter: any = {};
    if (params.entityType) filter["entity.type"] = params.entityType;
    if (params.entityId) filter["entity.id"] = params.entityId;

    return this.db
      .collection("audit_log")
      .find(filter)
      .sort({ at: -1 })
      .limit(limit)
      .toArray();
  }
}
