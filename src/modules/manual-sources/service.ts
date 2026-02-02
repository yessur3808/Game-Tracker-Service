import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Db, ObjectId } from "mongodb";
import { DB } from "../db.module";
import { AuditService } from "../audit/service";
import { Source } from "../../shared/types";
import { SourceSchema } from "../../shared/schemas";

@Injectable()
export class ManualSourcesService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  private col() {
    return this.db.collection("manual_sources");
  }

  async listByGameId(gameId: string) {
    return this.col().find({ gameId }).sort({ createdAt: -1 }).toArray();
  }

  async create(
    gameId: string,
    input: { source: Source; scope?: string },
    ctx: { actorId: string; reason?: string; request?: any },
  ) {
    const now = new Date().toISOString();

    const parsed = SourceSchema.safeParse(input.source);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const doc = {
      gameId,
      source: parsed.data,
      scope: input.scope ?? "general",
      createdAt: now,
      updatedAt: now,
    };

    const res = await this.col().insertOne(doc);

    await this.audit.append({
      at: now,
      actor: { type: "admin", id: ctx.actorId },
      action: "manual_source.create",
      entity: { type: "manual_source", id: String(res.insertedId) },
      reason: ctx.reason,
      after: { gameId, scope: doc.scope, url: doc.source.url },
      request: ctx.request,
    });

    return { _id: res.insertedId, ...doc };
  }

  async patch(
    sourceId: string,
    patch: { source?: Source; scope?: string },
    ctx: { actorId: string; reason?: string; request?: any },
  ) {
    const now = new Date().toISOString();
    const _id = new ObjectId(sourceId);

    const before = await this.col().findOne({ _id });
    if (!before) throw new NotFoundException("Manual source not found");

    const update: any = { updatedAt: now };
    if (patch.scope !== undefined) update.scope = patch.scope;

    if (patch.source !== undefined) {
      const parsed = SourceSchema.safeParse(patch.source);
      if (!parsed.success)
        throw new BadRequestException(parsed.error.flatten());
      update.source = parsed.data;
    }

    await this.col().updateOne({ _id }, { $set: update });

    await this.audit.append({
      at: now,
      actor: { type: "admin", id: ctx.actorId },
      action: "manual_source.patch",
      entity: { type: "manual_source", id: sourceId },
      reason: ctx.reason,
      patch,
      request: ctx.request,
    });

    return this.col().findOne({ _id });
  }

  async delete(
    sourceId: string,
    ctx: { actorId: string; reason?: string; request?: any },
  ) {
    const now = new Date().toISOString();
    const _id = new ObjectId(sourceId);

    const before = await this.col().findOne({ _id });
    if (!before) throw new NotFoundException("Manual source not found");

    await this.col().deleteOne({ _id });

    await this.audit.append({
      at: now,
      actor: { type: "admin", id: ctx.actorId },
      action: "manual_source.delete",
      entity: { type: "manual_source", id: sourceId },
      reason: ctx.reason,
      before: {
        gameId: (before as any).gameId,
        url: (before as any).source?.url,
      },
      request: ctx.request,
    });

    return { ok: true };
  }
}
