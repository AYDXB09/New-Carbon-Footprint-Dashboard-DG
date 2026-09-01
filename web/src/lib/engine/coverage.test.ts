import { describe, expect, it } from "vitest";
import { analyseCoverage, classifyCoverage } from "./coverage";

describe("classifyCoverage", () => {
  it("applies the 3-month and 12-month thresholds", () => {
    expect(classifyCoverage(0)).toBe("spot_check");
    expect(classifyCoverage(89)).toBe("spot_check");
    expect(classifyCoverage(90)).toBe("partial_year");
    expect(classifyCoverage(364)).toBe("partial_year");
    expect(classifyCoverage(365)).toBe("full_year");
    expect(classifyCoverage(400)).toBe("full_year");
  });
});

describe("analyseCoverage", () => {
  it("counts both endpoints as covered", () => {
    // January has 31 days; an inclusive period must not report 30.
    const c = analyseCoverage([{ start: "2025-01-01", end: "2025-01-31" }]);
    expect(c.coveredDays).toBe(31);
  });

  it("treats a calendar year as a full year", () => {
    const c = analyseCoverage([{ start: "2025-01-01", end: "2025-12-31" }]);
    expect(c.coveredDays).toBe(365);
    expect(c.coverageClass).toBe("full_year");
    expect(c.gaps).toEqual([]);
  });

  it("treats an academic year as equally a full year", () => {
    // Period alignment is not the question — period length is.
    const c = analyseCoverage([{ start: "2025-09-01", end: "2026-08-31" }]);
    expect(c.coveredDays).toBe(365);
    expect(c.coverageClass).toBe("full_year");
  });

  it("joins contiguous monthly readings into one span with no gaps", () => {
    const months = [
      { start: "2025-01-01", end: "2025-01-31" },
      { start: "2025-02-01", end: "2025-02-28" },
      { start: "2025-03-01", end: "2025-03-31" },
    ];
    const c = analyseCoverage(months);
    expect(c.coveredDays).toBe(31 + 28 + 31);
    expect(c.gaps).toEqual([]);
    expect(c.hasOverlap).toBe(false);
  });

  it("detects a missing month rather than reporting continuous coverage", () => {
    const c = analyseCoverage([
      { start: "2025-01-01", end: "2025-01-31" },
      { start: "2025-03-01", end: "2025-03-31" }, // February missing
    ]);
    expect(c.coveredDays).toBe(62);
    expect(c.spanDays).toBe(90);
    expect(c.gaps).toEqual([{ start: "2025-02-01", end: "2025-02-28" }]);
  });

  it("flags overlapping periods and does not double-count the shared days", () => {
    // A re-issued bill covering a month already submitted.
    const c = analyseCoverage([
      { start: "2025-01-01", end: "2025-02-28" },
      { start: "2025-02-01", end: "2025-03-31" },
    ]);
    expect(c.hasOverlap).toBe(true);
    expect(c.coveredDays).toBe(90); // Jan 1 - Mar 31, counted once
  });

  it("is order-independent", () => {
    const a = analyseCoverage([
      { start: "2025-03-01", end: "2025-03-31" },
      { start: "2025-01-01", end: "2025-01-31" },
    ]);
    const b = analyseCoverage([
      { start: "2025-01-01", end: "2025-01-31" },
      { start: "2025-03-01", end: "2025-03-31" },
    ]);
    expect(a).toEqual(b);
  });

  it("keeps eleven months short of a full year", () => {
    // The case the coverage tier exists for: high-quality data, incomplete span.
    const c = analyseCoverage([{ start: "2025-01-01", end: "2025-11-30" }]);
    expect(c.coverageClass).toBe("partial_year");
  });

  it("handles a leap year", () => {
    const c = analyseCoverage([{ start: "2024-01-01", end: "2024-12-31" }]);
    expect(c.coveredDays).toBe(366);
    expect(c.coverageClass).toBe("full_year");
  });

  it("returns an empty result for no readings", () => {
    const c = analyseCoverage([]);
    expect(c.coveredDays).toBe(0);
    expect(c.coverageClass).toBe("spot_check");
  });

  it("rejects a period that ends before it starts", () => {
    expect(() => analyseCoverage([{ start: "2025-06-01", end: "2025-01-01" }])).toThrow(
      /ends before/,
    );
  });

  it("rejects an unparseable date", () => {
    expect(() => analyseCoverage([{ start: "not-a-date", end: "2025-01-01" }])).toThrow(
      /Invalid date/,
    );
  });
});
