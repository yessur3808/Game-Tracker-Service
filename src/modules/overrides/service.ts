import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Db, ObjectId } from "mongodb";
import { DB } from "../db.module";
import { AuditService } from "../audit/service";
import { GameSchema } from "../../shared/schemas";
import { Game } from "../../shared/types";

@Injectable()
export class OverridesService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  private col() {
    return this.db.collection("manual_overrides");
  }

  async getEnabledForGame(gameId: string): Promise<{
    _id: ObjectId;
    gameId: string;
    enabled: boolean;
    patch: Partial<Game>;
  } | null> {
    return this.col().findOne({ gameId, enabled: true }) as any;
  }

  // allowlist validation: only allow overriding certain top-level keys
  private validatePatch(patch: Partial<Game>) {
    const allowedTop = new Set([
      "name",
      "category",
      "platforms",
      "availability",
      "release",
      "seasonWindow",
      "popularityRank",
      "tags",
      "sources",
    ]);

    for (const key of Object.keys(patch)) {
      if (!allowedTop.has(key)) {
        throw new BadRequestException(`Override patch key not allowed: ${key}`);
      }
    }

    // basic schema sanity: validate by applying to an empty skeleton is not enough.
    // We'll validate at compose time too. Here we can do a light check:
    if ((patch as any).id) {
      throw new BadRequestException("Override patch may not set id");
    }
  }

  async createForGame(
    gameId: string,
    input: { patch: Partial<Game>; enabled?: boolean; reason?: string },
    ctx: { actorId: string; request?: any },
  ) {
    const now = new Date().toISOString();
    this.validatePatch(input.patch);

    const enabled = input.enabled ?? true;

    // If enabling, disable previous enabled override
    if (enabled) {
      await this.col().updateMany(
        { gameId, enabled: true },
        { $set: { enabled: false, updatedAt: now } },
      );
    }

    const doc = {
      gameId,
      enabled,
      patch: input.patch,
      reason: input.reason,
      createdAt: now,
      updatedAt: now,
    };

    const res = await this.col().insertOne(doc);

    await this.audit.append({
      at: now,
      actor: { type: "admin", id: ctx.actorId },
      action: "override.create",
      entity: { type: "override", id: String(res.insertedId) },
      reason: input.reason,
      patch: input.patch,
      request: ctx.request,
    });

    return { _id: res.insertedId, ...doc };
  }

  async patchOverride(
    overrideId: string,
    input: { patch?: Partial<Game>; enabled?: boolean; reason?: string },
    ctx: { actorId: string; request?: any },
  ) {
    const now = new Date().toISOString();
    const _id = new ObjectId(overrideId);

    const before = await this.col().findOne({ _id });
    if (!before) throw new NotFoundException("Override not found");

    const update: any = { updatedAt: now };
    if (input.reason !== undefined) update.reason = input.reason;

    if (input.patch !== undefined) {
      this.validatePatch(input.patch);
      update.patch = input.patch;
    }

    if (input.enabled !== undefined) {
      update.enabled = input.enabled;
      if (input.enabled === true) {
        // disable any other enabled override for this game
        await this.col().updateMany(
          { gameId: (before as any).gameId, enabled: true, _id: { $ne: _id } },
          { $set: { enabled: false, updatedAt: now } },
        );
      }
    }

    await this.col().updateOne({ _id }, { $set: update });

    await this.audit.append({
      at: now,
      actor: { type: "admin", id: ctx.actorId },
      action: "override.patch",
      entity: { type: "override", id: overrideId },
      reason: input.reason,
      patch: input,
      request: ctx.request,
    });

    return this.col().findOne({ _id });
  }
}
