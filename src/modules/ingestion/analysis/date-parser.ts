/**
 * Natural-language date string → structured date information.
 *
 * Handles typical formats found in game store pages, press releases,
 * and social media posts (e.g. "March 12, 2025", "2025-03-12",
 * "Q1 2025", "Holiday 2025", "Early 2026", "TBA", "Coming Soon").
 */

export type ParsedDate = {
  /** Normalised ISO-8601 date when we can extract one (`YYYY-MM-DD`) */
  dateISO: string | null;
  /** How precise the original date string was */
  precision: "day" | "month" | "quarter" | "year" | "unknown";
  /** A rough announced window when precision < day */
  announcedWindow?: {
    label: string;
    year?: number;
    quarter?: 1 | 2 | 3 | 4;
    month?: number;
  };
  /** The original raw text we tried to parse */
  raw: string;
};

const MONTH_NAMES: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

/**
 * Attempt to parse a free-form date string into structured date info.
 */
export function parseReleaseDate(raw: string | null | undefined): ParsedDate {
  if (!raw || !raw.trim()) {
    return { dateISO: null, precision: "unknown", raw: raw ?? "" };
  }

  const text = raw.trim();

  // ISO-like: "2025-03-12" or "2025-03-12T00:00:00Z"
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return {
      dateISO: `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`,
      precision: "day",
      raw: text,
    };
  }

  // "March 12, 2025" or "12 March 2025" or "Mar 12 2025"
  const longDate = text.match(
    /([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/,
  );
  if (longDate) {
    const month = MONTH_NAMES[longDate[1].toLowerCase()];
    if (month) {
      const day = longDate[2].padStart(2, "0");
      return {
        dateISO: `${longDate[3]}-${String(month).padStart(2, "0")}-${day}`,
        precision: "day",
        raw: text,
      };
    }
  }

  // "12 March 2025"
  const dayFirst = text.match(
    /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/,
  );
  if (dayFirst) {
    const month = MONTH_NAMES[dayFirst[2].toLowerCase()];
    if (month) {
      const day = dayFirst[1].padStart(2, "0");
      return {
        dateISO: `${dayFirst[3]}-${String(month).padStart(2, "0")}-${day}`,
        precision: "day",
        raw: text,
      };
    }
  }

  // "MM/DD/YYYY" or "DD/MM/YYYY" — ambiguous, assume US format
  const slashDate = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slashDate) {
    const m = slashDate[1].padStart(2, "0");
    const d = slashDate[2].padStart(2, "0");
    return {
      dateISO: `${slashDate[3]}-${m}-${d}`,
      precision: "day",
      raw: text,
    };
  }

  // "March 2025" or "Sep 2025" → month precision
  const monthYear = text.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (monthYear) {
    const month = MONTH_NAMES[monthYear[1].toLowerCase()];
    if (month) {
      return {
        dateISO: null,
        precision: "month",
        announcedWindow: {
          label: text,
          year: Number(monthYear[2]),
          month,
        },
        raw: text,
      };
    }
  }

  // "Q1 2025" / "Q3 2026"
  const quarterMatch = text.match(/Q([1-4])\s*(\d{4})/i);
  if (quarterMatch) {
    return {
      dateISO: null,
      precision: "quarter",
      announcedWindow: {
        label: text,
        year: Number(quarterMatch[2]),
        quarter: Number(quarterMatch[1]) as 1 | 2 | 3 | 4,
      },
      raw: text,
    };
  }

  // "Early/Spring/Summer/Fall/Holiday/Late 2025"
  const seasonMatch = text.match(
    /(early|spring|summer|fall|autumn|winter|holiday|late)\s+(\d{4})/i,
  );
  if (seasonMatch) {
    const season = seasonMatch[1].toLowerCase();
    const year = Number(seasonMatch[2]);
    const quarterMap: Record<string, 1 | 2 | 3 | 4> = {
      early: 1,
      spring: 1,
      summer: 2,
      fall: 3,
      autumn: 3,
      winter: 4,
      holiday: 4,
      late: 4,
    };
    return {
      dateISO: null,
      precision: "quarter",
      announcedWindow: {
        label: text,
        year,
        quarter: quarterMap[season],
      },
      raw: text,
    };
  }

  // Just a year: "2025"
  const yearOnly = text.match(/^(\d{4})$/);
  if (yearOnly) {
    return {
      dateISO: null,
      precision: "year",
      announcedWindow: {
        label: text,
        year: Number(yearOnly[1]),
      },
      raw: text,
    };
  }

  // Couldn't parse
  return {
    dateISO: null,
    precision: "unknown",
    announcedWindow: { label: text },
    raw: text,
  };
}
