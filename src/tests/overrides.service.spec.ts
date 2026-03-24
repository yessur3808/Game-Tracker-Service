import { OverridesService } from "../modules/overrides/service";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ObjectId } from "mongodb";

function makeCol(overrides: Record<string, jest.Mock> = {}) {
  return {
    insertOne: jest.fn().mockResolvedValue({ insertedId: new ObjectId() }),
    findOne: jest.fn().mockResolvedValue(null),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
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

const CTX = { actorId: "admin-1" };

describe("OverridesService.createForGame", () => {
  it("inserts a new override document", async () => {
    const db = makeDb();
    const svc = new OverridesService(db, makeAudit());

    await svc.createForGame(
      "elden-ring",
      { patch: { name: "New Name" }, enabled: true, reason: "test" },
      CTX,
    );

    expect(db._col.insertOne).toHaveBeenCalledTimes(1);
    const doc = db._col.insertOne.mock.calls[0][0];
    expect(doc.gameId).toBe("elden-ring");
    expect(doc.enabled).toBe(true);
    expect(doc.patch).toEqual({ name: "New Name" });
  });

  it("records an audit event", async () => {
    const audit = makeAudit();
    const db = makeDb();
    const svc = new OverridesService(db, audit);

    await svc.createForGame("elden-ring", { patch: { name: "X" } }, CTX);
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: "override.create" }),
    );
  });

  it("disables previous enabled overrides when creating a new enabled one", async () => {
    const db = makeDb();
    const svc = new OverridesService(db, makeAudit());

    await svc.createForGame("elden-ring", { patch: { name: "X" }, enabled: true }, CTX);
    expect(db._col.updateMany).toHaveBeenCalledTimes(1);
    const updateManyArg = db._col.updateMany.mock.calls[0][0];
    expect(updateManyArg.gameId).toBe("elden-ring");
    expect(updateManyArg.enabled).toBe(true);
  });

  it("rejects patch containing disallowed keys", async () => {
    const db = makeDb();
    const svc = new OverridesService(db, makeAudit());
    await expect(
      svc.createForGame("elden-ring", { patch: { unknownField: "bad" } as any }, CTX),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects patch that tries to change id", async () => {
    const db = makeDb();
    const svc = new OverridesService(db, makeAudit());
    await expect(
      svc.createForGame("elden-ring", { patch: { id: "another-id" } as any }, CTX),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("OverridesService.patchOverride", () => {
  it("throws NotFoundException when override is not found", async () => {
    const db = makeDb(makeCol({ findOne: jest.fn().mockResolvedValue(null) }));
    const svc = new OverridesService(db, makeAudit());
    const id = new ObjectId().toString();
    await expect(svc.patchOverride(id, { enabled: false }, CTX)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("updates enabled flag on the override", async () => {
    const oid = new ObjectId();
    const existing = { _id: oid, gameId: "elden-ring", enabled: true, patch: {} };
    const col = makeCol({
      findOne: jest.fn().mockResolvedValue(existing),
    });
    const db = makeDb(col);
    const svc = new OverridesService(db, makeAudit());

    await svc.patchOverride(oid.toString(), { enabled: false }, CTX);
    expect(col.updateOne).toHaveBeenCalledTimes(1);
  });
});

describe("OverridesService.listByGameId", () => {
  it("returns override documents for a game", async () => {
    const overrides = [{ gameId: "elden-ring", patch: { name: "X" } }];
    const col = makeCol({
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        toArray: jest.fn().mockResolvedValue(overrides),
      }),
    });
    const db = makeDb(col);
    const svc = new OverridesService(db, makeAudit());

    const result = await svc.listByGameId("elden-ring");
    expect(result).toEqual(overrides);
  });
});
