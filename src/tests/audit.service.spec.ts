import { AuditService, AuditEvent } from "../modules/audit/service";

function makeDb(overrides: Record<string, jest.Mock> = {}) {
  const insertOne = jest.fn().mockResolvedValue({ insertedId: "abc" });
  const col = {
    insertOne,
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      toArray: jest.fn().mockResolvedValue([]),
    }),
    countDocuments: jest.fn().mockResolvedValue(0),
    ...overrides,
  };
  return {
    collection: jest.fn().mockReturnValue(col),
    _col: col,
  } as any;
}

function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    at: "2026-01-01T00:00:00.000Z",
    actor: { type: "admin", id: "admin-1" },
    action: "game.create",
    entity: { type: "game", id: "elden-ring" },
    ...overrides,
  };
}

describe("AuditService", () => {
  let db: ReturnType<typeof makeDb>;
  let svc: AuditService;

  beforeEach(() => {
    db = makeDb();
    svc = new AuditService(db);
  });

  describe("append", () => {
    it("inserts an event into the audit_log collection", async () => {
      const event = makeEvent();
      await svc.append(event);
      expect(db.collection).toHaveBeenCalledWith("audit_log");
      expect(db._col.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({ action: "game.create", actor: { type: "admin", id: "admin-1" } }),
      );
    });

    it("inserts all fields from the event", async () => {
      const event = makeEvent({ reason: "initial add", patch: { name: "New Name" } });
      await svc.append(event);
      const call = db._col.insertOne.mock.calls[0][0];
      expect(call.reason).toBe("initial add");
      expect(call.patch).toEqual({ name: "New Name" });
    });
  });

  describe("query", () => {
    it("queries the audit_log collection", async () => {
      await svc.query({ entityType: "game" });
      expect(db.collection).toHaveBeenCalledWith("audit_log");
    });

    it("applies entityType filter", async () => {
      await svc.query({ entityType: "game", entityId: "elden-ring" });
      const findArg = db._col.find.mock.calls[0][0];
      expect(findArg["entity.type"]).toBe("game");
      expect(findArg["entity.id"]).toBe("elden-ring");
    });

    it("limits results to 200 max", async () => {
      await svc.query({ limit: 9999 });
      const limitArg = db._col.find.mock.results[0].value.limit.mock.calls[0][0];
      expect(limitArg).toBe(200);
    });

    it("defaults limit to 50", async () => {
      await svc.query({});
      const limitArg = db._col.find.mock.results[0].value.limit.mock.calls[0][0];
      expect(limitArg).toBe(50);
    });

    it("returns an array of events", async () => {
      const events = [makeEvent({ action: "game.patch" })];
      db._col.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        toArray: jest.fn().mockResolvedValue(events),
      });
      const result = await svc.query({});
      expect(result).toEqual(events);
    });
  });
});
