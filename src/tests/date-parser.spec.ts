import { parseReleaseDate } from "../modules/ingestion/analysis/date-parser";

describe("parseReleaseDate", () => {
  describe("empty / null input", () => {
    it("returns unknown precision for null", () => {
      const r = parseReleaseDate(null);
      expect(r.dateISO).toBeNull();
      expect(r.precision).toBe("unknown");
      expect(r.raw).toBe("");
    });

    it("returns unknown precision for undefined", () => {
      const r = parseReleaseDate(undefined);
      expect(r.dateISO).toBeNull();
      expect(r.precision).toBe("unknown");
    });

    it("returns unknown precision for empty string", () => {
      const r = parseReleaseDate("  ");
      expect(r.dateISO).toBeNull();
      expect(r.precision).toBe("unknown");
    });
  });

  describe("ISO date strings", () => {
    it("parses YYYY-MM-DD", () => {
      const r = parseReleaseDate("2025-03-12");
      expect(r.dateISO).toBe("2025-03-12");
      expect(r.precision).toBe("day");
    });

    it("parses YYYY-MM-DDThh:mm:ssZ", () => {
      const r = parseReleaseDate("2025-03-12T00:00:00Z");
      expect(r.dateISO).toBe("2025-03-12");
      expect(r.precision).toBe("day");
    });
  });

  describe("named month formats", () => {
    it("parses 'March 12, 2025'", () => {
      const r = parseReleaseDate("March 12, 2025");
      expect(r.dateISO).toBe("2025-03-12");
      expect(r.precision).toBe("day");
    });

    it("parses 'Mar 12 2025' (abbreviated month)", () => {
      const r = parseReleaseDate("Mar 12 2025");
      expect(r.dateISO).toBe("2025-03-12");
      expect(r.precision).toBe("day");
    });

    it("parses '12 March 2025' (day-first)", () => {
      const r = parseReleaseDate("12 March 2025");
      expect(r.dateISO).toBe("2025-03-12");
      expect(r.precision).toBe("day");
    });

    it("parses 'January 1, 2026'", () => {
      const r = parseReleaseDate("January 1, 2026");
      expect(r.dateISO).toBe("2026-01-01");
      expect(r.precision).toBe("day");
    });
  });

  describe("slash date formats", () => {
    it("parses MM/DD/YYYY (treated as US format)", () => {
      const r = parseReleaseDate("03/12/2025");
      expect(r.dateISO).toBe("2025-03-12");
      expect(r.precision).toBe("day");
    });

    it("parses with dashes MM-DD-YYYY", () => {
      const r = parseReleaseDate("03-12-2025");
      expect(r.dateISO).toBe("2025-03-12");
      expect(r.precision).toBe("day");
    });
  });

  describe("month + year precision", () => {
    it("parses 'March 2025'", () => {
      const r = parseReleaseDate("March 2025");
      expect(r.dateISO).toBeNull();
      expect(r.precision).toBe("month");
      expect(r.announcedWindow?.year).toBe(2025);
      expect(r.announcedWindow?.month).toBe(3);
    });

    it("parses 'Sep 2025'", () => {
      const r = parseReleaseDate("Sep 2025");
      expect(r.dateISO).toBeNull();
      expect(r.precision).toBe("month");
      expect(r.announcedWindow?.month).toBe(9);
    });
  });

  describe("quarter precision", () => {
    it("parses 'Q1 2025'", () => {
      const r = parseReleaseDate("Q1 2025");
      expect(r.dateISO).toBeNull();
      expect(r.precision).toBe("quarter");
      expect(r.announcedWindow?.quarter).toBe(1);
      expect(r.announcedWindow?.year).toBe(2025);
    });

    it("parses 'Q3 2026'", () => {
      const r = parseReleaseDate("Q3 2026");
      expect(r.precision).toBe("quarter");
      expect(r.announcedWindow?.quarter).toBe(3);
    });

    it("parses 'Early 2025' as Q1", () => {
      const r = parseReleaseDate("Early 2025");
      expect(r.precision).toBe("quarter");
      expect(r.announcedWindow?.quarter).toBe(1);
    });

    it("parses 'Holiday 2025' as Q4", () => {
      const r = parseReleaseDate("Holiday 2025");
      expect(r.precision).toBe("quarter");
      expect(r.announcedWindow?.quarter).toBe(4);
    });

    it("parses 'Summer 2025' as Q2", () => {
      const r = parseReleaseDate("Summer 2025");
      expect(r.precision).toBe("quarter");
      expect(r.announcedWindow?.quarter).toBe(2);
    });

    it("parses 'Fall 2025' as Q3", () => {
      const r = parseReleaseDate("Fall 2025");
      expect(r.precision).toBe("quarter");
      expect(r.announcedWindow?.quarter).toBe(3);
    });

    it("parses 'Late 2025' as Q4", () => {
      const r = parseReleaseDate("Late 2025");
      expect(r.precision).toBe("quarter");
      expect(r.announcedWindow?.quarter).toBe(4);
    });
  });

  describe("year only precision", () => {
    it("parses '2025'", () => {
      const r = parseReleaseDate("2025");
      expect(r.dateISO).toBeNull();
      expect(r.precision).toBe("year");
      expect(r.announcedWindow?.year).toBe(2025);
    });
  });

  describe("unparseable strings", () => {
    it("returns unknown precision for 'TBA'", () => {
      const r = parseReleaseDate("TBA");
      expect(r.dateISO).toBeNull();
      expect(r.precision).toBe("unknown");
      expect(r.raw).toBe("TBA");
    });

    it("returns unknown for 'Coming Soon'", () => {
      const r = parseReleaseDate("Coming Soon");
      expect(r.precision).toBe("unknown");
    });
  });

  describe("raw field", () => {
    it("preserves the raw input string", () => {
      const r = parseReleaseDate("Q2 2026");
      expect(r.raw).toBe("Q2 2026");
    });
  });
});
