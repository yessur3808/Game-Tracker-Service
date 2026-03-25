import { ManualSourcesService } from "../modules/manual-sources/service";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ObjectId } from "mongodb";

function makeCol(overrides: Record<string, jest.Mock> = {}) {
  return {
    insertOne: jest.fn().mockResolvedValue({ insertedId: new ObjectId() }),
    findOne: jest.fn().mockResolvedValue(null),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      toArray: jest.fn().mockResolvedValue([]),
    }),
    ...overrides,
  };
}

function makeDb(col?: ReturnType<typeof makeCol>) {
  const c = col ?? makeCol();
  return {
    collection: jest.fn().mockReturnValue(c),
    _col: c,
  } as any;
}

function makeAudit() {
  return { append: jest.fn().mockResolvedValue(undefined) } as any;
}

function validSource() {
  return {
    type: "platform_store" as const,
    name: "Steam",
    isOfficial: true,
    reliability: "high" as const,
    url: "https://store.steampowered.com/app/1245620/",
    retrievedAt: "2026-01-01T00:00:00.000Z",
  };
}

const CTX = { actorId: "admin-1" };

describe("ManualSourcesService.create", () => {
  it("inserts a valid manual source", async () => {
    const db = makeDb();
    const svc = new ManualSourcesService(db, makeAudit());

    await svc.create("elden-ring", { source: validSource() }, CTX);
    expect(db._col.insertOne).toHaveBeenCalledTimes(1);
    const doc = db._col.insertOne.mock.calls[0][0];
    expect(doc.gameId).toBe("elden-ring");
    expect(doc.source.name).toBe("Steam");
  });

  it("records an audit event", async () => {
    const audit = makeAudit();
    const db = makeDb();
    const svc = new ManualSourcesService(db, audit);

    await svc.create("elden-ring", { source: validSource() }, CTX);
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: "manual_source.create" }),
    );
  });

  it("throws BadRequestException for invalid source data", async () => {
    const db = makeDb();
    const svc = new ManualSourcesService(db, makeAudit());

    await expect(
      svc.create("elden-ring", { source: { type: "invalid_type" } as any }, CTX),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("stores the scope on the document", async () => {
    const db = makeDb();
    const svc = new ManualSourcesService(db, makeAudit());

    await svc.create("elden-ring", { source: validSource(), scope: "release" }, CTX);
    const doc = db._col.insertOne.mock.calls[0][0];
    expect(doc.scope).toBe("release");
  });

  it("defaults scope to 'general' when not provided", async () => {
    const db = makeDb();
    const svc = new ManualSourcesService(db, makeAudit());

    await svc.create("elden-ring", { source: validSource() }, CTX);
    const doc = db._col.insertOne.mock.calls[0][0];
    expect(doc.scope).toBe("general");
  });
});

describe("ManualSourcesService.patch", () => {
  it("throws NotFoundException when source is not found", async () => {
    const db = makeDb(makeCol({ findOne: jest.fn().mockResolvedValue(null) }));
    const svc = new ManualSourcesService(db, makeAudit());

    await expect(
      svc.patch(new ObjectId().toString(), { scope: "release" }, CTX),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("updates the scope", async () => {
    const oid = new ObjectId();
    const existing = { _id: oid, gameId: "elden-ring", source: validSource(), scope: "general" };
    const col = makeCol({
      findOne: jest.fn().mockResolvedValue(existing),
    });
    const db = makeDb(col);
    const svc = new ManualSourcesService(db, makeAudit());

    await svc.patch(oid.toString(), { scope: "release" }, CTX);
    expect(col.updateOne).toHaveBeenCalledTimes(1);
    const setArg = col.updateOne.mock.calls[0][1].$set;
    expect(setArg.scope).toBe("release");
  });

  it("validates source data on patch", async () => {
    const oid = new ObjectId();
    const existing = { _id: oid, gameId: "elden-ring", source: validSource(), scope: "general" };
    const col = makeCol({
      findOne: jest.fn().mockResolvedValue(existing),
    });
    const db = makeDb(col);
    const svc = new ManualSourcesService(db, makeAudit());

    await expect(
      svc.patch(oid.toString(), { source: { type: "bad_type" } as any }, CTX),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("ManualSourcesService.delete", () => {
  it("throws NotFoundException when source is not found", async () => {
    const db = makeDb(makeCol({ findOne: jest.fn().mockResolvedValue(null) }));
    const svc = new ManualSourcesService(db, makeAudit());

    await expect(svc.delete(new ObjectId().toString(), CTX)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("deletes the source and records audit event", async () => {
    const oid = new ObjectId();
    const existing = { _id: oid, gameId: "elden-ring", source: validSource() };
    const col = makeCol({ findOne: jest.fn().mockResolvedValue(existing) });
    const audit = makeAudit();
    const db = makeDb(col);
    const svc = new ManualSourcesService(db, audit);

    const result = await svc.delete(oid.toString(), CTX);
    expect(col.deleteOne).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true });
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: "manual_source.delete" }),
    );
  });
});

describe("ManualSourcesService.listByGameId", () => {
  it("returns documents for a game sorted by createdAt desc", async () => {
    const docs = [{ gameId: "elden-ring", source: validSource() }];
    const col = makeCol({
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        toArray: jest.fn().mockResolvedValue(docs),
      }),
    });
    const db = makeDb(col);
    const svc = new ManualSourcesService(db, makeAudit());

    const result = await svc.listByGameId("elden-ring");
    expect(result).toEqual(docs);
  });
});
