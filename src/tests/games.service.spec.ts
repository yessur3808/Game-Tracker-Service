import { GamesService } from "../modules/games/service";
import { BadRequestException, NotFoundException } from "@nestjs/common";

/* ------------------------------------------------------------------ */
/*  Minimal valid game document                                        */
/* ------------------------------------------------------------------ */

function minimalGame(overrides: Record<string, unknown> = {}) {
  return {
    id: "elden-ring",
    name: "Elden Ring",
    category: { type: "full_game" },
    platforms: ["PC"],
    availability: "released",
    release: {
      status: "released",
      isOfficial: true,
      confidence: "official",
      dateISO: "2022-02-25",
      sources: [],
    },
    sources: [],
    ...overrides,
  } as any;
}

/* ------------------------------------------------------------------ */
/*  Mock factory                                                       */
/* ------------------------------------------------------------------ */

function makeCol(overrides: Record<string, jest.Mock> = {}) {
  return {
    insertOne: jest.fn().mockResolvedValue({ insertedId: "oid1" }),
    findOne: jest.fn().mockResolvedValue(null),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      toArray: jest.fn().mockResolvedValue([]),
    }),
    countDocuments: jest.fn().mockResolvedValue(0),
    ...overrides,
  };
}

function makeDb(collectionMap: Record<string, ReturnType<typeof makeCol>> = {}) {
  const defaultCol = makeCol();
  return {
    collection: jest.fn((name: string) => collectionMap[name] ?? defaultCol),
    _default: defaultCol,
    _cols: collectionMap,
  } as any;
}

function makeAudit() {
  return { append: jest.fn().mockResolvedValue(undefined) } as any;
}

function makeManualSources(sourceDocs: any[] = []) {
  return { listByGameId: jest.fn().mockResolvedValue(sourceDocs) } as any;
}

function makeOverrides(override: any = null) {
  return { getEnabledForGame: jest.fn().mockResolvedValue(override) } as any;
}

/* ------------------------------------------------------------------ */
/*  createGame                                                         */
/* ------------------------------------------------------------------ */

describe("GamesService.createGame", () => {
  it("inserts a valid game into the DB", async () => {
    const gamesCol = makeCol();
    const db = makeDb({ games: gamesCol });
    const svc = new GamesService(db, makeAudit(), makeManualSources(), makeOverrides());

    const result = await svc.createGame(minimalGame(), { actorId: "admin-1" });
    expect(gamesCol.insertOne).toHaveBeenCalledTimes(1);
    expect(result.id).toBe("elden-ring");
  });

  it("throws BadRequestException for invalid game data", async () => {
    const db = makeDb();
    const svc = new GamesService(db, makeAudit(), makeManualSources(), makeOverrides());
    await expect(svc.createGame({ id: "" } as any, { actorId: "admin-1" })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("records an audit event on creation", async () => {
    const audit = makeAudit();
    const db = makeDb({ games: makeCol() });
    const svc = new GamesService(db, audit, makeManualSources(), makeOverrides());

    await svc.createGame(minimalGame(), { actorId: "admin-1", reason: "initial" });
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: "game.create", actor: { type: "admin", id: "admin-1" } }),
    );
  });
});

/* ------------------------------------------------------------------ */
/*  patchCanonicalGame                                                 */
/* ------------------------------------------------------------------ */

describe("GamesService.patchCanonicalGame", () => {
  it("throws NotFoundException when game does not exist", async () => {
    const db = makeDb({ games: makeCol({ findOne: jest.fn().mockResolvedValue(null) }) });
    const svc = new GamesService(db, makeAudit(), makeManualSources(), makeOverrides());
    await expect(svc.patchCanonicalGame("nonexistent", {}, { actorId: "a" })).rejects.toBeInstanceOf(NotFoundException);
  });

  it("updates the game in the DB and records an audit", async () => {
    const game = minimalGame();
    const updatedGame = { ...game, name: "Elden Ring: Shadow" };
    const gamesCol = makeCol({
      findOne: jest.fn()
        .mockResolvedValueOnce(game)    // initial findOne for before
        .mockResolvedValueOnce(updatedGame),  // final findOne return
    });
    const audit = makeAudit();
    const db = makeDb({ games: gamesCol });
    const svc = new GamesService(db, audit, makeManualSources(), makeOverrides());

    const result = await svc.patchCanonicalGame("elden-ring", { name: "Elden Ring: Shadow" }, { actorId: "a" });
    expect(gamesCol.updateOne).toHaveBeenCalledTimes(1);
    expect(audit.append).toHaveBeenCalledWith(expect.objectContaining({ action: "game.patch" }));
  });
});

/* ------------------------------------------------------------------ */
/*  deleteGame                                                         */
/* ------------------------------------------------------------------ */

describe("GamesService.deleteGame", () => {
  it("throws NotFoundException when game does not exist", async () => {
    const db = makeDb({ games: makeCol({ findOne: jest.fn().mockResolvedValue(null) }) });
    const svc = new GamesService(db, makeAudit(), makeManualSources(), makeOverrides());
    await expect(svc.deleteGame("nonexistent", { actorId: "a" })).rejects.toBeInstanceOf(NotFoundException);
  });

  it("deletes the game and records an audit event", async () => {
    const game = minimalGame();
    const gamesCol = makeCol({ findOne: jest.fn().mockResolvedValue(game) });
    const audit = makeAudit();
    const db = makeDb({ games: gamesCol });
    const svc = new GamesService(db, audit, makeManualSources(), makeOverrides());

    const result = await svc.deleteGame("elden-ring", { actorId: "admin-1" });
    expect(gamesCol.deleteOne).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true });
    expect(audit.append).toHaveBeenCalledWith(expect.objectContaining({ action: "game.delete" }));
  });
});

/* ------------------------------------------------------------------ */
/*  getComposedById                                                    */
/* ------------------------------------------------------------------ */

describe("GamesService.getComposedById", () => {
  it("returns null when the game is not found", async () => {
    const db = makeDb({ games: makeCol({ findOne: jest.fn().mockResolvedValue(null) }) });
    const svc = new GamesService(db, makeAudit(), makeManualSources(), makeOverrides());
    const result = await svc.getComposedById("nonexistent");
    expect(result).toBeNull();
  });

  it("returns composed game with no overrides or manual sources", async () => {
    const game = minimalGame();
    const gamesCol = makeCol({ findOne: jest.fn().mockResolvedValue(game) });
    const db = makeDb({ games: gamesCol });
    const svc = new GamesService(db, makeAudit(), makeManualSources([]), makeOverrides(null));

    const result = await svc.getComposedById("elden-ring");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("elden-ring");
  });

  it("applies an active override's patch", async () => {
    const game = minimalGame();
    const override = {
      _id: "oid1",
      gameId: "elden-ring",
      enabled: true,
      patch: { name: "Override Name" },
    };
    const gamesCol = makeCol({ findOne: jest.fn().mockResolvedValue(game) });
    const db = makeDb({ games: gamesCol });
    const svc = new GamesService(db, makeAudit(), makeManualSources([]), makeOverrides(override));

    const result = await svc.getComposedById("elden-ring");
    expect(result!.name).toBe("Override Name");
  });
});
