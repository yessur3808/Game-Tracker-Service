import {
  extractMetaContent,
  extractTitleTag,
  extractDescription,
  extractJsonLd,
  extractReleaseLikeText,
  extractJsonLdReleaseDate,
  extractPrice,
  extractAllFromHtml,
} from "../modules/ingestion/providers/html.util";

/* ------------------------------------------------------------------ */
/*  extractMetaContent                                                 */
/* ------------------------------------------------------------------ */
describe("extractMetaContent", () => {
  it("extracts content from property-first meta tag", () => {
    const html = `<meta property="og:title" content="Elden Ring">`;
    expect(extractMetaContent(html, "og:title")).toBe("Elden Ring");
  });

  it("extracts content from content-first meta tag", () => {
    const html = `<meta content="Elden Ring" property="og:title">`;
    expect(extractMetaContent(html, "og:title")).toBe("Elden Ring");
  });

  it("extracts name-based meta tag", () => {
    const html = `<meta name="description" content="A great game">`;
    expect(extractMetaContent(html, "description")).toBe("A great game");
  });

  it("returns null when meta tag is absent", () => {
    expect(extractMetaContent("<html></html>", "og:title")).toBeNull();
  });

  it("handles single quotes in attributes", () => {
    const html = `<meta property='og:title' content='My Game'>`;
    expect(extractMetaContent(html, "og:title")).toBe("My Game");
  });
});

/* ------------------------------------------------------------------ */
/*  extractTitleTag                                                    */
/* ------------------------------------------------------------------ */
describe("extractTitleTag", () => {
  it("extracts text from <title>", () => {
    const html = `<html><head><title>  My Game Page  </title></head></html>`;
    expect(extractTitleTag(html)).toBe("My Game Page");
  });

  it("returns null when no <title> exists", () => {
    expect(extractTitleTag("<html></html>")).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  extractDescription                                                 */
/* ------------------------------------------------------------------ */
describe("extractDescription", () => {
  it("prefers og:description over meta description", () => {
    const html = `
      <meta property="og:description" content="OG Desc">
      <meta name="description" content="Meta Desc">
    `;
    expect(extractDescription(html)).toBe("OG Desc");
  });

  it("falls back to meta description when og:description absent", () => {
    const html = `<meta name="description" content="Meta Desc">`;
    expect(extractDescription(html)).toBe("Meta Desc");
  });

  it("returns null when neither is present", () => {
    expect(extractDescription("<html></html>")).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  extractJsonLd                                                      */
/* ------------------------------------------------------------------ */
describe("extractJsonLd", () => {
  it("extracts name from JSON-LD", () => {
    const html = `
      <script type="application/ld+json">
        {"@type": "VideoGame", "name": "Elden Ring", "releaseDate": "2022-02-25"}
      </script>
    `;
    const r = extractJsonLd(html);
    expect(r.name).toBe("Elden Ring");
    expect(r.releaseDate).toBe("2022-02-25");
  });

  it("extracts price from offers", () => {
    const html = `
      <script type="application/ld+json">
        {"@type": "VideoGame", "name": "Test", "offers": {"price": "59.99", "priceCurrency": "USD"}}
      </script>
    `;
    const r = extractJsonLd(html);
    expect(r.price).toBe("59.99 USD");
  });

  it("extracts genres", () => {
    const html = `
      <script type="application/ld+json">
        {"@type": "VideoGame", "genre": ["Action", "RPG"]}
      </script>
    `;
    const r = extractJsonLd(html);
    expect(r.genres).toEqual(["Action", "RPG"]);
  });

  it("extracts platforms from gamePlatform", () => {
    const html = `
      <script type="application/ld+json">
        {"@type": "VideoGame", "gamePlatform": ["PC", "PS5"]}
      </script>
    `;
    const r = extractJsonLd(html);
    expect(r.platforms).toEqual(["PC", "PS5"]);
  });

  it("handles malformed JSON-LD gracefully", () => {
    const html = `
      <script type="application/ld+json">
        { this is not valid json
      </script>
    `;
    expect(() => extractJsonLd(html)).not.toThrow();
    const r = extractJsonLd(html);
    expect(r.name).toBeUndefined();
  });

  it("handles multiple JSON-LD blocks, takes first name", () => {
    const html = `
      <script type="application/ld+json">{"name": "First Game"}</script>
      <script type="application/ld+json">{"name": "Second Game"}</script>
    `;
    const r = extractJsonLd(html);
    expect(r.name).toBe("First Game");
  });

  it("handles JSON-LD array at root", () => {
    const html = `
      <script type="application/ld+json">
        [{"name": "Array Game", "releaseDate": "2024-01-01"}]
      </script>
    `;
    const r = extractJsonLd(html);
    expect(r.name).toBe("Array Game");
  });

  it("extracts image from string", () => {
    const html = `
      <script type="application/ld+json">
        {"name": "Test", "image": "https://example.com/cover.jpg"}
      </script>
    `;
    const r = extractJsonLd(html);
    expect(r.image).toBe("https://example.com/cover.jpg");
  });
});

/* ------------------------------------------------------------------ */
/*  extractReleaseLikeText                                             */
/* ------------------------------------------------------------------ */
describe("extractReleaseLikeText", () => {
  it("extracts a date after 'Release Date:'", () => {
    const html = `<p>Release Date: March 12, 2025</p>`;
    const r = extractReleaseLikeText(html);
    expect(r).toBe("March 12, 2025");
  });

  it("extracts ISO-like date after 'release date'", () => {
    const html = `<span>release date: 2025-03-12</span>`;
    const r = extractReleaseLikeText(html);
    expect(r).toBe("2025-03-12");
  });

  it("returns null when no release date text is present", () => {
    expect(extractReleaseLikeText("<html><body>No dates here</body></html>")).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  extractJsonLdReleaseDate                                           */
/* ------------------------------------------------------------------ */
describe("extractJsonLdReleaseDate", () => {
  it("extracts releaseDate from inline JSON", () => {
    const html = `window.__DATA__ = {"releaseDate": "2025-03-12"}`;
    expect(extractJsonLdReleaseDate(html)).toBe("2025-03-12");
  });

  it("returns null when key is absent", () => {
    expect(extractJsonLdReleaseDate(`<html></html>`)).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  extractPrice                                                       */
/* ------------------------------------------------------------------ */
describe("extractPrice", () => {
  it("extracts price from JSON-LD offers", () => {
    const html = `
      <script type="application/ld+json">
        {"offers": {"price": "29.99", "priceCurrency": "USD"}}
      </script>
    `;
    expect(extractPrice(html)).toBe("29.99 USD");
  });

  it("extracts product:price meta", () => {
    const html = `
      <meta property="product:price:amount" content="39.99">
      <meta property="product:price:currency" content="EUR">
    `;
    expect(extractPrice(html)).toBe("39.99 EUR");
  });

  it("returns null when no price found", () => {
    expect(extractPrice("<html></html>")).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  extractAllFromHtml                                                 */
/* ------------------------------------------------------------------ */
describe("extractAllFromHtml", () => {
  const buildHtml = ({
    ogTitle = "",
    ogDescription = "",
    ogImage = "",
    ldJson = "",
  }: {
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
    ldJson?: string;
  }) => `
    <html>
      <head>
        <meta property="og:title" content="${ogTitle}">
        <meta property="og:description" content="${ogDescription}">
        <meta property="og:image" content="${ogImage}">
        ${ldJson}
      </head>
    </html>
  `;

  it("extracts all fields from a well-formed page", () => {
    const html = buildHtml({
      ogTitle: "Elden Ring",
      ogDescription: "An open-world RPG",
      ogImage: "https://example.com/cover.jpg",
      ldJson: `<script type="application/ld+json">{"releaseDate":"2022-02-25","genre":["RPG"],"gamePlatform":["PC"]}</script>`,
    });

    const r = extractAllFromHtml(html);
    expect(r.name).toBe("Elden Ring");
    expect(r.description).toBe("An open-world RPG");
    expect(r.coverUrl).toBe("https://example.com/cover.jpg");
    expect(r.releaseDateISO).toBe("2022-02-25");
    expect(r.genres).toContain("RPG");
    expect(r.platforms).toContain("PC");
  });

  it("falls back to <title> when og:title is absent", () => {
    const html = `<html><head><title>Game Title</title></head></html>`;
    const r = extractAllFromHtml(html);
    expect(r.name).toBe("Game Title");
  });

  it("returns null/empty for a page with no useful data", () => {
    const r = extractAllFromHtml("<html><body>nothing</body></html>");
    expect(r.name).toBeNull();
    expect(r.description).toBeNull();
    expect(r.releaseText).toBeNull();
    expect(r.releaseDateISO).toBeNull();
    expect(r.coverUrl).toBeNull();
    expect(r.price).toBeNull();
    expect(r.genres).toEqual([]);
    expect(r.platforms).toEqual([]);
  });
});
