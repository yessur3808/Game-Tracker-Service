import { GameSchema, SourceSchema, ReleaseSchema, CategorySchema } from "../shared/schemas";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
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
  };
}

function minimalSource(overrides: Record<string, unknown> = {}) {
  return {
    type: "platform_store",
    name: "Steam",
    isOfficial: true,
    reliability: "high",
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  SourceSchema                                                       */
/* ------------------------------------------------------------------ */

describe("SourceSchema", () => {
  it("accepts a minimal valid source", () => {
    const r = SourceSchema.safeParse(minimalSource());
    expect(r.success).toBe(true);
  });

  it("accepts an optional URL", () => {
    const r = SourceSchema.safeParse(minimalSource({ url: "https://store.steampowered.com/app/1245620" }));
    expect(r.success).toBe(true);
  });

  it("rejects an invalid URL", () => {
    const r = SourceSchema.safeParse(minimalSource({ url: "not-a-url" }));
    expect(r.success).toBe(false);
  });

  it("rejects an unknown type", () => {
    const r = SourceSchema.safeParse(minimalSource({ type: "unknown_type" }));
    expect(r.success).toBe(false);
  });

  it("rejects empty name", () => {
    const r = SourceSchema.safeParse(minimalSource({ name: "" }));
    expect(r.success).toBe(false);
  });

  it("rejects invalid reliability value", () => {
    const r = SourceSchema.safeParse(minimalSource({ reliability: "very_high" }));
    expect(r.success).toBe(false);
  });

  it("rejects credibilityScore out of range", () => {
    const r = SourceSchema.safeParse(minimalSource({ credibilityScore: 101 }));
    expect(r.success).toBe(false);
  });

  it("accepts credibilityScore in valid range", () => {
    const r = SourceSchema.safeParse(minimalSource({ credibilityScore: 75 }));
    expect(r.success).toBe(true);
  });

  it("rejects retrievedAt that is not ISO-8601", () => {
    const r = SourceSchema.safeParse(minimalSource({ retrievedAt: "not-a-date" }));
    expect(r.success).toBe(false);
  });

  it("accepts a valid retrievedAt ISO-8601 string", () => {
    const r = SourceSchema.safeParse(minimalSource({ retrievedAt: "2026-01-01T00:00:00.000Z" }));
    expect(r.success).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  CategorySchema                                                     */
/* ------------------------------------------------------------------ */

describe("CategorySchema", () => {
  it("accepts a minimal category with type only", () => {
    const r = CategorySchema.safeParse({ type: "full_game" });
    expect(r.success).toBe(true);
  });

  it("accepts a season category with extra fields", () => {
    const r = CategorySchema.safeParse({
      type: "season",
      gameId: "fortnite",
      seasonNumber: 4,
      seasonName: "Season 4",
    });
    expect(r.success).toBe(true);
  });

  it("rejects unknown category type", () => {
    const r = CategorySchema.safeParse({ type: "expansion" });
    expect(r.success).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  ReleaseSchema                                                      */
/* ------------------------------------------------------------------ */

describe("ReleaseSchema", () => {
  it("requires dateISO when status is 'released'", () => {
    const r = ReleaseSchema.safeParse({
      status: "released",
      isOfficial: true,
      confidence: "official",
      sources: [],
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("dateISO");
    }
  });

  it("passes when status is 'released' and dateISO is provided", () => {
    const r = ReleaseSchema.safeParse({
      status: "released",
      isOfficial: true,
      confidence: "official",
      dateISO: "2022-02-25",
      sources: [],
    });
    expect(r.success).toBe(true);
  });

  it("requires timeUTC when status is 'recurring_daily'", () => {
    const r = ReleaseSchema.safeParse({
      status: "recurring_daily",
      isOfficial: true,
      confidence: "official",
      sources: [],
    });
    expect(r.success).toBe(false);
  });

  it("requires timeUTC and dayOfWeekUTC when status is 'recurring_weekly'", () => {
    const r = ReleaseSchema.safeParse({
      status: "recurring_weekly",
      isOfficial: true,
      confidence: "official",
      timeUTC: "20:00",
      sources: [],
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("dayOfWeekUTC");
    }
  });

  it("passes for recurring_weekly with timeUTC and dayOfWeekUTC", () => {
    const r = ReleaseSchema.safeParse({
      status: "recurring_weekly",
      isOfficial: true,
      confidence: "official",
      timeUTC: "20:00",
      dayOfWeekUTC: 5,
      sources: [],
    });
    expect(r.success).toBe(true);
  });

  it("rejects timeUTC in wrong format", () => {
    const r = ReleaseSchema.safeParse({
      status: "upcoming",
      isOfficial: true,
      confidence: "official",
      timeUTC: "8:00pm",
      sources: [],
    });
    expect(r.success).toBe(false);
  });

  it("accepts an announced_window with quarter", () => {
    const r = ReleaseSchema.safeParse({
      status: "upcoming",
      isOfficial: true,
      confidence: "likely",
      announced_window: { label: "Q2 2026", year: 2026, quarter: 2 },
      sources: [],
    });
    expect(r.success).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  GameSchema                                                         */
/* ------------------------------------------------------------------ */

describe("GameSchema", () => {
  it("accepts a minimal valid game", () => {
    const r = GameSchema.safeParse(minimalGame());
    expect(r.success).toBe(true);
  });

  it("rejects a game missing required id", () => {
    const { id: _omit, ...noId } = minimalGame();
    const r = GameSchema.safeParse(noId);
    expect(r.success).toBe(false);
  });

  it("rejects a game with empty name", () => {
    const r = GameSchema.safeParse(minimalGame({ name: "" }));
    expect(r.success).toBe(false);
  });

  it("rejects invalid availability value", () => {
    const r = GameSchema.safeParse(minimalGame({ availability: "maybe" }));
    expect(r.success).toBe(false);
  });

  it("accepts optional fields (description, tags, genres, externalIds)", () => {
    const r = GameSchema.safeParse(
      minimalGame({
        description: "An epic adventure",
        tags: ["soulslike"],
        genres: ["Action", "RPG"],
        externalIds: { steam: 1245620, igdb: 119133 },
      }),
    );
    expect(r.success).toBe(true);
  });

  it("rejects description longer than 5000 chars", () => {
    const r = GameSchema.safeParse(minimalGame({ description: "x".repeat(5001) }));
    expect(r.success).toBe(false);
  });

  it("rejects invalid coverUrl", () => {
    const r = GameSchema.safeParse(minimalGame({ coverUrl: "not-a-url" }));
    expect(r.success).toBe(false);
  });

  it("accepts valid coverUrl", () => {
    const r = GameSchema.safeParse(minimalGame({ coverUrl: "https://example.com/cover.jpg" }));
    expect(r.success).toBe(true);
  });

  it("rejects externalIds with non-integer steam id", () => {
    const r = GameSchema.safeParse(minimalGame({ externalIds: { steam: -1 } }));
    expect(r.success).toBe(false);
  });

  it("defaults platforms to [] when not provided", () => {
    const g = { ...minimalGame() };
    delete (g as any).platforms;
    const r = GameSchema.safeParse(g);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.platforms).toEqual([]);
  });
});
