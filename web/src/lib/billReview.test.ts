import { describe, expect, it } from "vitest";
import {
  checkReviewRow,
  matchUnitId,
  overallConfidence,
  reviewRowToReading,
  toReviewRows,
  type ReviewRow,
} from "./billReview";

const meters = [
  { id: "m1", location: "Main Building", meter_number: "DEWA-88213" },
  { id: "m2", location: "Annex", meter_number: null },
];
const row = (over: Partial<ReviewRow> = {}): ReviewRow => ({
  key: "r0",
  meterNumber: "",
  periodStart: "2025-09-01",
  periodEnd: "2025-09-30",
  quantity: "41230",
  unitId: "kWh",
  meterId: "m1",
  confidence: "high",
  ambiguity: null,
  ...over,
});

describe("matchUnitId", () => {
  it.each([
    ["energy", "kWh", "kWh"],
    ["energy", "KWH", "kWh"],
    ["energy", "MWh", "MWh"],
    ["energy", "therms", "therms"],
    ["water", "m³", "m3"],
    ["water", "m3", "m3"],
    ["water", "kL", "m3"],
    ["water", "Cubic Metres", "m3"],
    ["water", "litres", "litre"],
    ["water", "US gal", "US gallons"],
    ["water", "gal", null], // US and UK gallons differ by about 20%
    ["energy", "kVAh", null],
    ["energy", "", null],
  ])("%s %j -> %j", (module, text, expected) => {
    expect(matchUnitId(module as "energy" | "water", text)).toBe(expected);
  });
});

describe("toReviewRows", () => {
  const good = { meter_number: "dewa 88213", period_start: "2025-09-01", period_end: "2025-09-30", quantity: 41230, unit: "kWh", confidence: "high" };

  it("matches the meter by its printed number, ignoring case and punctuation", () => {
    const { rows } = toReviewRows({ readings: [good] }, "energy", meters);
    expect(rows[0]).toMatchObject({ meterId: "m1", unitId: "kWh", quantity: "41230", periodStart: "2025-09-01" });
  });
  it("uses the only meter when there is just one, and leaves it blank when there are several", () => {
    const noNumber = { ...good, meter_number: undefined };
    expect(toReviewRows({ readings: [noNumber] }, "energy", [meters[0]]).rows[0].meterId).toBe("m1");
    expect(toReviewRows({ readings: [noNumber] }, "energy", meters).rows[0].meterId).toBe("");
  });
  it("blanks a malformed date rather than 'fixing' it", () => {
    const { rows } = toReviewRows({ readings: [{ ...good, period_start: "01/09/2025" }] }, "energy", meters);
    expect(rows[0].periodStart).toBe("");
  });
  it("flags an unrecognised unit for the school to choose", () => {
    const { rows } = toReviewRows({ readings: [{ ...good, unit: "kVAh" }] }, "energy", meters);
    expect(rows[0].unitId).toBe("");
    expect(rows[0].ambiguity).toMatch(/kVAh/);
  });
  it("treats an unknown confidence as low and carries the model's own doubt through", () => {
    const { rows } = toReviewRows({ readings: [{ ...good, confidence: "sure", ambiguity: "also shows 38 kW demand" }] }, "energy", meters);
    expect(rows[0].confidence).toBe("low");
    expect(rows[0].ambiguity).toBe("also shows 38 kW demand");
  });
  it.each([null, undefined, "x", 4, [], { readings: "no" }, { readings: [null, 3, "x"] }])("survives junk %j", (junk) => {
    expect(toReviewRows(junk, "energy", meters).rows).toEqual([]);
  });
  it("returns the document notes", () => {
    expect(toReviewRows({ readings: [], notes: "Not a bill." }, "energy", meters).notes).toBe("Not a bill.");
  });
});

describe("checkReviewRow", () => {
  const check = (r: ReviewRow, existing = [] as Parameters<typeof checkReviewRow>[2], others: ReviewRow[] = []) =>
    checkReviewRow(r, "energy", existing, others);

  it("accepts a complete row", () => expect(check(row())).toBeNull());
  it("needs a meter, both dates, a positive number and a unit", () => {
    expect(check(row({ meterId: "" }))).toMatch(/meter/);
    expect(check(row({ periodStart: "" }))).toMatch(/dates/);
    expect(check(row({ quantity: "abc" }))).toMatch(/number/);
    expect(check(row({ quantity: "0" }))).toMatch(/above zero/);
    expect(check(row({ unitId: "" }))).toMatch(/unit/);
    expect(check(row({ unitId: "gallons" }))).toMatch(/unit/);
  });
  it("needs the end date after the start", () => {
    expect(check(row({ periodEnd: "2025-09-01" }))).toMatch(/after the start/);
  });
  it("accepts a quantity typed with thousands separators", () => {
    expect(check(row({ quantity: "41,230" }))).toBeNull();
  });
  it("blocks an overlap with a saved reading for the same meter only", () => {
    const saved = [{ meter_id: "m1", period_start: "2025-09-15", period_end: "2025-10-15", quantity: 1 }];
    expect(check(row(), saved)).toMatch(/already saved/);
    expect(check(row({ meterId: "m2" }), saved)).toBeNull();
  });
  it("blocks two rows of one bill that overlap on the same meter", () => {
    const a = row({ key: "a" });
    const b = row({ key: "b", periodStart: "2025-09-20", periodEnd: "2025-10-20" });
    expect(check(a, [], [a, b])).toMatch(/another reading/);
  });
});

describe("saving", () => {
  it("converts to the canonical unit", () => {
    expect(reviewRowToReading(row({ quantity: "2", unitId: "MWh" }), "energy")).toEqual({
      meterId: "m1",
      quantity: 2000,
      periodStart: "2025-09-01",
      periodEnd: "2025-09-30",
    });
  });
  it("records the weakest confidence in the set", () => {
    expect(overallConfidence([row(), row({ confidence: "medium" })])).toBe(0.6);
    expect(overallConfidence([row({ confidence: "low" }), row()])).toBe(0.3);
    expect(overallConfidence([])).toBe(0);
  });
});
