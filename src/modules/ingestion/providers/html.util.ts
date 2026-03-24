/**
 * Shared HTML extraction utilities used by all scraping providers.
 * Centralises the duplicated parsing logic that was previously scattered
 * across every provider file.
 */

/* ------------------------------------------------------------------ */
/*  Low-level helpers                                                  */
/* ------------------------------------------------------------------ */

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ------------------------------------------------------------------ */
/*  Meta / title helpers                                               */
/* ------------------------------------------------------------------ */

/**
 * Extracts the `content` value of a `<meta>` tag whose `property` or
 * `name` attribute matches {@link propertyOrName}.
 * Handles both `property="..." content="..."` and reversed attribute order.
 */
export function extractMetaContent(
  html: string,
  propertyOrName: string,
): string | null {
  const esc = escapeRegExp(propertyOrName);

  // property/name first, then content
  const re1 = new RegExp(
    `<meta\\s+[^>]*(?:property|name)=["']${esc}["'][^>]*content=["']([^"']+)["'][^>]*>`,
    "i",
  );
  const m1 = html.match(re1);
  if (m1?.[1]) return m1[1].trim();

  // content first, then property/name (reversed order)
  const re2 = new RegExp(
    `<meta\\s+[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']${esc}["'][^>]*>`,
    "i",
  );
  const m2 = html.match(re2);
  return m2?.[1]?.trim() ?? null;
}

/** Extracts plain text inside the first `<title>` tag. */
export function extractTitleTag(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m?.[1]?.trim() ?? null;
}

/** Extracts the `og:description` or `meta description`. */
export function extractDescription(html: string): string | null {
  return (
    extractMetaContent(html, "og:description") ??
    extractMetaContent(html, "description") ??
    null
  );
}

/* ------------------------------------------------------------------ */
/*  JSON-LD structured data                                            */
/* ------------------------------------------------------------------ */

export type JsonLdData = {
  name?: string;
  releaseDate?: string;
  description?: string;
  image?: string;
  price?: string;
  genres?: string[];
  platforms?: string[];
};

/**
 * Attempts to parse ALL `<script type="application/ld+json">` blocks
 * from the HTML and returns a merged {@link JsonLdData} object with
 * the best-effort extracted fields.
 */
export function extractJsonLd(html: string): JsonLdData {
  const result: JsonLdData = {};
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    try {
      const raw = JSON.parse(match[1]);
      mergeJsonLdObject(result, raw);
    } catch {
      // malformed JSON-LD — skip
    }
  }
  return result;
}

function mergeJsonLdObject(out: JsonLdData, obj: any): void {
  if (!obj || typeof obj !== "object") return;

  // JSON-LD can be an array (multiple entries)
  if (Array.isArray(obj)) {
    for (const item of obj) mergeJsonLdObject(out, item);
    return;
  }

  if (typeof obj.name === "string" && !out.name) {
    out.name = obj.name;
  }

  // releaseDate / datePublished
  const dateField =
    obj.releaseDate ?? obj.datePublished ?? obj.dateCreated ?? null;
  if (typeof dateField === "string" && !out.releaseDate) {
    out.releaseDate = dateField.trim();
  }

  if (typeof obj.description === "string" && !out.description) {
    out.description = obj.description;
  }

  // image can be a string or an object with url
  if (!out.image) {
    if (typeof obj.image === "string") out.image = obj.image;
    else if (typeof obj.image?.url === "string") out.image = obj.image.url;
  }

  // price – look in offers
  if (!out.price && obj.offers) {
    const offers = Array.isArray(obj.offers) ? obj.offers : [obj.offers];
    for (const o of offers) {
      if (typeof o.price === "string" || typeof o.price === "number") {
        const currency = o.priceCurrency ?? "";
        out.price = `${o.price} ${currency}`.trim();
        break;
      }
    }
  }

  // genre
  if (!out.genres) {
    if (Array.isArray(obj.genre)) {
      out.genres = obj.genre.filter((g: unknown) => typeof g === "string");
    } else if (typeof obj.genre === "string") {
      out.genres = [obj.genre];
    }
  }

  // platform / gamePlatform
  if (!out.platforms) {
    const plat = obj.gamePlatform ?? obj.platform ?? obj.operatingSystem;
    if (Array.isArray(plat)) {
      out.platforms = plat.filter((p: unknown) => typeof p === "string");
    } else if (typeof plat === "string") {
      out.platforms = [plat];
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Release-date text heuristics                                       */
/* ------------------------------------------------------------------ */

/**
 * Searches for a "release date" label followed by a date-like value
 * using loose regex heuristics.
 */
export function extractReleaseLikeText(html: string): string | null {
  // "Release date" or "Release Date:" followed by date-like text
  const m = html.match(
    /release\s*date[:\s]*[^<]{0,30}?([A-Z][a-z]+\s+\d{1,2},?\s*\d{4}|\d{4}[-/]\d{2}[-/]\d{2}|\d{1,2}[-/]\d{1,2}[-/]\d{4}|[A-Z][a-z]+\s+\d{4}|Q[1-4]\s+\d{4})/i,
  );
  return m?.[1]?.trim() ?? null;
}

/**
 * Attempts to find a `"releaseDate"` key in inline JSON (e.g. JSON-LD
 * fragments or React hydration data) without full JSON parsing.
 */
export function extractJsonLdReleaseDate(html: string): string | null {
  const m = html.match(/"releaseDate"\s*:\s*"([^"]+)"/i);
  return m?.[1]?.trim() ?? null;
}

/* ------------------------------------------------------------------ */
/*  Price extraction                                                   */
/* ------------------------------------------------------------------ */

/**
 * Best-effort price extraction from meta tags, JSON-LD, and common
 * store patterns.  Returns a raw string like "$59.99 USD" or null.
 */
export function extractPrice(html: string): string | null {
  // JSON-LD price
  const ld = extractJsonLd(html);
  if (ld.price) return ld.price;

  // og:price
  const ogPrice = extractMetaContent(html, "product:price:amount");
  const ogCurrency = extractMetaContent(html, "product:price:currency");
  if (ogPrice) return `${ogPrice} ${ogCurrency ?? ""}`.trim();

  return null;
}

/* ------------------------------------------------------------------ */
/*  Convenience: full structured extraction                            */
/* ------------------------------------------------------------------ */

export type HtmlExtracted = {
  name: string | null;
  description: string | null;
  releaseText: string | null;
  releaseDateISO: string | null;
  coverUrl: string | null;
  price: string | null;
  genres: string[];
  platforms: string[];
};

/**
 * One-call extraction that pulls from JSON-LD first, then falls back
 * to meta tags and heuristic regex patterns.
 */
export function extractAllFromHtml(html: string): HtmlExtracted {
  const ld = extractJsonLd(html);

  const name =
    extractMetaContent(html, "og:title") ??
    ld.name ??
    extractTitleTag(html) ??
    null;

  const releaseDateISO = ld.releaseDate ?? null;
  const releaseText =
    releaseDateISO ??
    extractJsonLdReleaseDate(html) ??
    extractReleaseLikeText(html) ??
    null;

  const coverUrl =
    extractMetaContent(html, "og:image") ?? ld.image ?? null;

  const description =
    extractDescription(html) ?? ld.description ?? null;

  const price = extractPrice(html);

  const genres = ld.genres ?? [];
  const platforms = ld.platforms ?? [];

  return {
    name,
    description,
    releaseText,
    releaseDateISO,
    coverUrl,
    price,
    genres,
    platforms,
  };
}
