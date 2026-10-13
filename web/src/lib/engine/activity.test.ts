import { describe, expect, it } from "vitest";
import { runActivitySimulation, type ActivityInput } from "./activity";
import { runEnergySimulation } from "./energy";
import type { Factor } from "./types";

const factor = (over: Partial<Factor> = {}): Factor => ({
  value: 0.4,
  unit: "kgCO2e/m3",
  uncertaintyPct: 10,
  sourceName: "Test set",
  sourceOrg: "Test Org",
  vintageYear: 2026,
  ...over,
});

const base = (over: Partial<ActivityInput> = {}): ActivityInput => ({
  readings: [{ quantity: 1000, periodStart: "2025-01-01", periodEnd: "2025-12-31", factorKeys: ["a"] }],
  factors: { a: factor() },
  quantityUnit: "m3",
  quantityLabel: "Water supplied",
  ...over,
});

describe("runEnergySimulation stays put after moving onto the shared sampler", () => {
  // These are the README's own worked example (seed 42, 10,000 iterations), so a
  // change to the random stream or the maths shows up here, not in a user's report.
  const r = runEnergySimulation(
    {
      readings: [{ consumptionKwh: 1_109_200, periodStart: "2025-09-01", periodEnd: "2026-08-31" }],
      gridIntensity: factor({ value: 0.3582, unit: "kgCO2e/kWh" }),
      denominators: { gfaConditionedM2: 8000, studentsTotal: 600 },
    },
    { seed: 42, iterations: 10_000 },
  );
  it("gives the README's 397.1 (350.6 - 451.7) tCO2e", () => {
    expect(r.emissionsKgCo2e.median / 1000).toBeCloseTo(397.1, 1);
    expect(r.emissionsKgCo2e.p10 / 1000).toBeCloseTo(350.6, 1);
    expect(r.emissionsKgCo2e.p90 / 1000).toBeCloseTo(451.7, 1);
  });
  it("matches the generic engine exactly for a single factor", () => {
    const g = runActivitySimulation(
      {
        readings: [{ quantity: 1_109_200, periodStart: "2025-09-01", periodEnd: "2026-08-31", factorKeys: ["g"] }],
        factors: { g: factor({ value: 0.3582, unit: "kgCO2e/kWh" }) },
        quantityUnit: "kWh",
        quantityLabel: "Metered consumption",
      },
      { seed: 42, iterations: 10_000 },
    );
    expect(g.emissionsKgCo2e.p10).toBe(r.emissionsKgCo2e.p10);
    expect(g.emissionsKgCo2e.median).toBe(r.emissionsKgCo2e.median);
    expect(g.emissionsKgCo2e.p90).toBe(r.emissionsKgCo2e.p90);
  });
});

describe("runActivitySimulation", () => {
  it("is reproducible from its seed and independent of reading order", () => {
    const readings = [
      { quantity: 400, periodStart: "2025-01-01", periodEnd: "2025-06-30", factorKeys: ["a"] },
      { quantity: 600, periodStart: "2025-07-01", periodEnd: "2025-12-31", factorKeys: ["a"] },
    ];
    const one = runActivitySimulation(base({ readings }), { seed: 7, iterations: 2000 });
    const two = runActivitySimulation(base({ readings: [...readings].reverse() }), { seed: 7, iterations: 2000 });
    expect(two.emissionsKgCo2e.median).toBe(one.emissionsKgCo2e.median);
    expect(one.totalQuantity).toBe(1000);
  });

  it("adds several factors that price the same quantity (e.g. water supply + treatment)", () => {
    const r = runActivitySimulation(
      base({
        readings: [{ quantity: 100, periodStart: "2025-01-01", periodEnd: "2025-12-31", factorKeys: ["supply", "treat"] }],
        factors: { supply: factor({ value: 0.2, uncertaintyPct: 0 }), treat: factor({ value: 0.15, uncertaintyPct: 0 }) },
      }),
      { seed: 1, iterations: 100 },
    );
    expect(r.emissionsKgCo2e.median).toBeCloseTo(100 * 0.35, 9);
    expect(r.emissionsKgCo2e.relativeBandPct).toBe(0);
  });

  it("prices each reading with its own factor (e.g. waste by disposal route)", () => {
    const r = runActivitySimulation(
      base({
        readings: [
          { quantity: 2, periodStart: "2025-01-01", periodEnd: "2025-12-31", factorKeys: ["landfill"], meterId: "m1" },
          { quantity: 10, periodStart: "2025-01-01", periodEnd: "2025-12-31", factorKeys: ["recycled"], meterId: "m2" },
        ],
        factors: {
          landfill: factor({ value: 500, uncertaintyPct: 0 }),
          recycled: factor({ value: 5, uncertaintyPct: 0 }),
        },
      }),
      { seed: 1, iterations: 50 },
    );
    expect(r.emissionsKgCo2e.median).toBeCloseTo(2 * 500 + 10 * 5, 9);
  });

  it("draws a factor once, so readings sharing it move together", () => {
    // Splitting 1000 across two readings with the SAME uncertain factor must give
    // the same relative band as one reading — the error is one shared number. If each
    // reading drew its own factor the band would shrink (independent errors average out).
    const one = runActivitySimulation(base(), { seed: 3, iterations: 4000 });
    const two = runActivitySimulation(
      base({
        readings: [
          { quantity: 500, periodStart: "2025-01-01", periodEnd: "2025-06-30", factorKeys: ["a"] },
          { quantity: 500, periodStart: "2025-07-01", periodEnd: "2025-12-31", factorKeys: ["a"] },
        ],
      }),
      { seed: 3, iterations: 4000 },
    );
    expect(two.emissionsKgCo2e.relativeBandPct).toBeCloseTo(one.emissionsKgCo2e.relativeBandPct, 6);
  });

  it("widens the band as factor uncertainty grows", () => {
    const narrow = runActivitySimulation(base({ factors: { a: factor({ uncertaintyPct: 5 }) } }), { seed: 9 });
    const wide = runActivitySimulation(base({ factors: { a: factor({ uncertaintyPct: 50 }) } }), { seed: 9 });
    expect(wide.emissionsKgCo2e.relativeBandPct).toBeGreaterThan(narrow.emissionsKgCo2e.relativeBandPct * 3);
  });

  it("puts the quantity first in the derivation, whatever the module", () => {
    const r = runActivitySimulation(base(), { seed: 1, iterations: 100 });
    expect(r.derivation[0]).toMatchObject({ label: "Water supplied", value: 1000, unit: "m3" });
    expect(r.derivation.some((s) => s.source?.includes("Test Org"))).toBe(true);
  });

  it("judges coverage per meter: two meters over the same months are not double-counting", () => {
    const r = runActivitySimulation(
      base({
        readings: [
          { quantity: 10, periodStart: "2025-01-01", periodEnd: "2025-12-31", factorKeys: ["a"], meterId: "m1" },
          { quantity: 20, periodStart: "2025-01-01", periodEnd: "2025-12-31", factorKeys: ["a"], meterId: "m2" },
        ],
      }),
      { seed: 1, iterations: 100 },
    );
    expect(r.coverage.hasOverlap).toBe(false);
    expect(r.coverage.coverageClass).toBe("full_year");
    expect(r.totalQuantity).toBe(30);
  });

  it("flags the whole figure as partial when one meter is short", () => {
    const r = runActivitySimulation(
      base({
        readings: [
          { quantity: 10, periodStart: "2025-01-01", periodEnd: "2025-12-31", factorKeys: ["a"], meterId: "m1" },
          { quantity: 2, periodStart: "2025-01-01", periodEnd: "2025-04-30", factorKeys: ["a"], meterId: "m2" },
        ],
      }),
      { seed: 1, iterations: 100 },
    );
    expect(r.coverage.coverageClass).toBe("partial_year");
    expect(r.isPartialPeriod).toBe(true);
  });

  it("still warns when the SAME meter has overlapping bills", () => {
    const r = runActivitySimulation(
      base({
        readings: [
          { quantity: 10, periodStart: "2025-01-01", periodEnd: "2025-02-28", factorKeys: ["a"], meterId: "m1" },
          { quantity: 10, periodStart: "2025-02-01", periodEnd: "2025-03-31", factorKeys: ["a"], meterId: "m1" },
        ],
      }),
      { seed: 1, iterations: 100 },
    );
    expect(r.coverage.hasOverlap).toBe(true);
    expect(r.derivation.some((s) => /double-count/i.test(s.detail))).toBe(true);
  });

  it("refuses a factor whose unit does not match the readings", () => {
    expect(() =>
      runActivitySimulation(base({ factors: { a: factor({ unit: "kgCO2e/litre" }) } }), { seed: 1 }),
    ).toThrow(/kgCO2e\/litre.*m3/);
  });

  it("rejects input that cannot produce an honest number", () => {
    expect(() => runActivitySimulation(base({ readings: [] }), { seed: 1 })).toThrow(/no readings/);
    expect(() =>
      runActivitySimulation(base({ readings: [{ quantity: 1, periodStart: "2025-01-01", periodEnd: "2025-02-01", factorKeys: ["zzz"] }] }), { seed: 1 }),
    ).toThrow(/No factor supplied/);
    expect(() =>
      runActivitySimulation(base({ readings: [{ quantity: -1, periodStart: "2025-01-01", periodEnd: "2025-02-01", factorKeys: ["a"] }] }), { seed: 1 }),
    ).toThrow(/zero or positive/);
    expect(() =>
      runActivitySimulation(base({ readings: [{ quantity: 1, periodStart: "2025-01-01", periodEnd: "2025-02-01", factorKeys: [] }] }), { seed: 1 }),
    ).toThrow(/no factor/i);
    expect(() => runActivitySimulation(base(), { seed: 1, iterations: 0 })).toThrow(/iterations/);
  });
});
