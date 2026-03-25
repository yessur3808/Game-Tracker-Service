import {
  normalizeProviderResult,
  mergeProviderResults,
} from "../modules/ingestion/analysis/normalizer";
import { ProviderResult } from "../modules/ingestion/providers/types";

function makeResult(overrides: Partial<ProviderResult> = {}): ProviderResult {
  return {
    provider: "steam",
    fetchedAt: "2025-01-01T00:00:00.000Z",
    url: "https://store.steampowered.com/app/1245620/",
    name: "Elden Ring",
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  normalizeProviderResult                                            */
/* ------------------------------------------------------------------ */

describe("normalizeProviderResult", () => {
  it("sets the game id from the argument", () => {
    const g = normalizeProviderResult(makeResult(), "elden-ring");
    expect(g.id).toBe("elden-ring");
  });

  it("uses result.name as game name", () => {
    const g = normalizeProviderResult(makeResult({ name: "Elden Ring" }), "elden-ring");
    expect(g.name).toBe("Elden Ring");
  });

  it("falls back to gameId when name is missing", () => {
    const g = normalizeProviderResult(makeResult({ name: null }), "my-game-id");
    expect(g.name).toBe("my-game-id");
  });

  it("attaches a platform_store source", () => {
    const g = normalizeProviderResult(makeResult(), "elden-ring");
    expect(g.sources.length).toBe(1);
    expect(g.sources[0].type).toBe("platform_store");
    expect(g.sources[0].name).toBe("steam");
  });

  it("normalises platforms", () => {
    const g = normalizeProviderResult(makeResult({ platforms: ["ps5", "pc", "xbox series x"] }), "my-game");
    expect(g.platforms).toContain("PS5");
    expect(g.platforms).toContain("PC");
    expect(g.platforms).toContain("Xbox Series X|S");
  });

  it("deduplicates platforms", () => {
    const g = normalizeProviderResult(makeResult({ platforms: ["pc", "windows"] }), "x");
    expect(g.platforms.filter((p) => p === "PC").length).toBe(1);
  });

  it("sets release.status to 'released' for a past ISO date", () => {
    const g = normalizeProviderResult(makeResult({ releaseDateISO: "2020-01-01" }), "x");
    expect(g.release.status).toBe("released");
    expect(g.availability).toBe("released");
  });

  it("sets release.status to 'upcoming' for a future ISO date", () => {
    const g = normalizeProviderResult(makeResult({ releaseDateISO: "2099-01-01" }), "x");
    expect(g.release.status).toBe("upcoming");
    expect(g.availability).toBe("upcoming");
  });

  it("sets release.status to 'announced' when only a window is known", () => {
    const g = normalizeProviderResult(makeResult({ releaseText: "Q3 2099", releaseDateISO: null }), "x");
    expect(g.release.status).toBe("announced");
    expect(g.availability).toBe("upcoming");
  });

  it("propagates coverUrl", () => {
    const g = normalizeProviderResult(
      makeResult({ coverUrl: "https://cdn.example.com/cover.jpg" }),
      "x",
    );
    expect(g.coverUrl).toBe("https://cdn.example.com/cover.jpg");
  });

  it("sets category to full_game by default", () => {
    const g = normalizeProviderResult(makeResult(), "x");
    expect(g.category.type).toBe("full_game");
  });

  it("sets updatedAt to an ISO string", () => {
    const g = normalizeProviderResult(makeResult(), "x");
    expect(g.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

/* ------------------------------------------------------------------ */
/*  mergeProviderResults                                               */
/* ------------------------------------------------------------------ */

describe("mergeProviderResults", () => {
  it("throws when called with an empty array", () => {
    expect(() => mergeProviderResults([], "x")).toThrow();
  });

  it("returns a single normalised game for one result", () => {
    const g = mergeProviderResults([makeResult()], "elden-ring");
    expect(g.id).toBe("elden-ring");
  });

  it("merges sources from multiple providers, deduplicating by URL", () => {
    const r1 = makeResult({ provider: "steam", url: "https://store.steampowered.com/app/1/" });
    const r2 = makeResult({ provider: "playstation", url: "https://store.playstation.com/game/1" });
    const g = mergeProviderResults([r1, r2], "x");
    expect(g.sources.length).toBe(2);
  });

  it("does not duplicate a source with the same URL", () => {
    const sharedUrl = "https://store.steampowered.com/app/1/";
    const r1 = makeResult({ provider: "steam", url: sharedUrl });
    const r2 = makeResult({ provider: "steam", url: sharedUrl });
    const g = mergeProviderResults([r1, r2], "x");
    // Only one source with that URL should be in the list
    const matching = g.sources.filter((s) => s.url === sharedUrl);
    expect(matching.length).toBe(1);
  });

  it("unions platforms across providers", () => {
    const r1 = makeResult({ provider: "steam", platforms: ["pc"] });
    const r2 = makeResult({ provider: "playstation", url: "https://store.playstation.com/g/1", platforms: ["ps5"] });
    const g = mergeProviderResults([r1, r2], "x");
    expect(g.platforms).toContain("PC");
    expect(g.platforms).toContain("PS5");
  });

  it("picks release date from secondary when primary has none", () => {
    const primary = makeResult({ provider: "steam", releaseDateISO: null, releaseText: null });
    const secondary = makeResult({
      provider: "playstation",
      url: "https://store.playstation.com/g/1",
      releaseDateISO: "2022-02-25",
    });
    const g = mergeProviderResults([primary, secondary], "x");
    expect(g.release.dateISO).toBe("2022-02-25");
  });

  it("takes coverUrl from secondary when primary lacks it", () => {
    const primary = makeResult({ provider: "steam", coverUrl: null });
    const secondary = makeResult({
      provider: "playstation",
      url: "https://store.playstation.com/g/1",
      coverUrl: "https://cdn.example.com/cover.jpg",
    });
    const g = mergeProviderResults([primary, secondary], "x");
    expect(g.coverUrl).toBe("https://cdn.example.com/cover.jpg");
  });
});
