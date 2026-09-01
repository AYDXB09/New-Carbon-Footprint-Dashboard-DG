import { describe, expect, it } from "vitest";
import { runEnergySimulation, type EnergyInput, type Factor } from "./energy";

const factor = (over: Partial<Factor> = {}): Factor => ({
  value: 0.4,
  unit: "kgCO2e/kWh",
  uncertaintyPct: 10,
  sourceName: "Test grid mix",
  sourceOrg: "Test Org",
  vintageYear: 2025,
  ...over,
});

const fullYear = (kwh: number): EnergyInput["readings"] => [
  { consumptionKwh: kwh, periodStart: "2025-01-01", periodEnd: "2025-12-31" },
];

describe("runEnergySimulation", () => {
  it("is reproducible from its seed", () => {
    const input: EnergyInput = { readings: fullYear(500_000), gridIntensity: factor() };
    const a = runEnergySimulation(input, { seed: 42, iterations: 2000 });
    const b = runEnergySimulation(input, { seed: 42, iterations: 2000 });
    expect(a.emissionsKgCo2e).toEqual(b.emissionsKgCo2e);
  });

  it("gives a different band for a different seed, but the same central value", () => {
    const input: EnergyInput = { readings: fullYear(500_000), gridIntensity: factor() };
    const a = runEnergySimulation(input, { seed: 1, iterations: 20_000 });
    const b = runEnergySimulation(input, { seed: 2, iterations: 20_000 });
    expect(a.emissionsKgCo2e.p10).not.toBe(b.emissionsKgCo2e.p10);
    // Same inputs, so the medians must agree to within sampling noise.
    expect(a.emissionsKgCo2e.median).toBeCloseTo(b.emissionsKgCo2e.median, -3);
  });

  it("centres the median on consumption x factor", () => {
    const r = runEnergySimulation(
      { readings: fullYear(1_000_000), gridIntensity: factor({ uncertaintyPct: 15 }) },
      { seed: 7, iterations: 30_000 },
    );
    // 1,000,000 kWh x 0.4 kgCO2e/kWh = 400,000 kgCO2e
    expect(r.emissionsKgCo2e.median).toBeGreaterThan(392_000);
    expect(r.emissionsKgCo2e.median).toBeLessThan(408_000);
  });

  it("collapses to a single exact value when the factor has no uncertainty", () => {
    const r = runEnergySimulation(
      { readings: fullYear(250_000), gridIntensity: factor({ uncertaintyPct: null }) },
      { seed: 3, iterations: 1000 },
    );
    expect(r.emissionsKgCo2e.median).toBeCloseTo(100_000, 6);
    expect(r.emissionsKgCo2e.p10).toBeCloseTo(100_000, 6);
    expect(r.emissionsKgCo2e.p90).toBeCloseTo(100_000, 6);
    expect(r.emissionsKgCo2e.relativeBandPct).toBeCloseTo(0, 6);
  });

  it("widens the band as factor uncertainty grows — the tier mechanism", () => {
    // This is the property the whole tier system rests on: worse-known inputs
    // produce a visibly wider range, with no separate confidence score.
    const narrow = runEnergySimulation(
      { readings: fullYear(500_000), gridIntensity: factor({ uncertaintyPct: 5 }) },
      { seed: 9, iterations: 20_000 },
    );
    const wide = runEnergySimulation(
      { readings: fullYear(500_000), gridIntensity: factor({ uncertaintyPct: 40 }) },
      { seed: 9, iterations: 20_000 },
    );
    expect(wide.emissionsKgCo2e.relativeBandPct).toBeGreaterThan(
      narrow.emissionsKgCo2e.relativeBandPct * 3,
    );
  });

  it("never produces a negative emissions figure", () => {
    const r = runEnergySimulation(
      { readings: fullYear(100_000), gridIntensity: factor({ uncertaintyPct: 80 }) },
      { seed: 5, iterations: 20_000 },
    );
    expect(r.emissionsKgCo2e.p10).toBeGreaterThan(0);
  });

  it("sums multiple readings and reports their combined coverage", () => {
    const r = runEnergySimulation(
      {
        readings: [
          { consumptionKwh: 100, periodStart: "2025-01-01", periodEnd: "2025-06-30" },
          { consumptionKwh: 150, periodStart: "2025-07-01", periodEnd: "2025-12-31" },
        ],
        gridIntensity: factor(),
      },
      { seed: 1, iterations: 500 },
    );
    expect(r.totalConsumptionKwh).toBe(250);
    expect(r.coverage.coverageClass).toBe("full_year");
    expect(r.isPartialPeriod).toBe(false);
  });

  it("flags a partial period instead of silently annualising it", () => {
    const r = runEnergySimulation(
      {
        readings: [
          { consumptionKwh: 100_000, periodStart: "2025-01-01", periodEnd: "2025-04-30" },
        ],
        gridIntensity: factor(),
      },
      { seed: 1, iterations: 500 },
    );
    expect(r.isPartialPeriod).toBe(true);
    expect(r.coverage.coverageClass).toBe("partial_year");
    // Un-annualised: still exactly the submitted consumption, not scaled up.
    expect(r.totalConsumptionKwh).toBe(100_000);
  });

  it("warns in the derivation when periods overlap", () => {
    const r = runEnergySimulation(
      {
        readings: [
          { consumptionKwh: 100, periodStart: "2025-01-01", periodEnd: "2025-02-28" },
          { consumptionKwh: 100, periodStart: "2025-02-01", periodEnd: "2025-03-31" },
        ],
        gridIntensity: factor(),
      },
      { seed: 1, iterations: 500 },
    );
    expect(r.coverage.hasOverlap).toBe(true);
    expect(r.derivation.some((s) => /double-count/i.test(s.detail))).toBe(true);
  });

  it("computes per-area and per-student intensities from the denominators", () => {
    const r = runEnergySimulation(
      {
        readings: fullYear(1_000_000),
        gridIntensity: factor({ uncertaintyPct: null }),
        denominators: { gfaConditionedM2: 10_000, studentsTotal: 800 },
      },
      { seed: 1, iterations: 500 },
    );
    expect(r.intensity.euiPerM2).toBeCloseTo(100, 6); // 1,000,000 / 10,000
    expect(r.intensity.euiPerStudent).toBeCloseTo(1250, 6); // 1,000,000 / 800
    expect(r.intensity.emissionsPerM2).toBeCloseTo(40, 6); // 400,000 / 10,000
  });

  it("returns null intensities rather than guessing when denominators are absent", () => {
    const r = runEnergySimulation(
      { readings: fullYear(1_000_000), gridIntensity: factor() },
      { seed: 1, iterations: 500 },
    );
    expect(r.intensity.euiPerM2).toBeNull();
    expect(r.intensity.euiPerStudent).toBeNull();
    expect(r.intensity.emissionsPerM2).toBeNull();
  });

  it("treats a zero denominator as unknown rather than dividing by it", () => {
    const r = runEnergySimulation(
      {
        readings: fullYear(1000),
        gridIntensity: factor(),
        denominators: { gfaConditionedM2: 0, studentsTotal: 0 },
      },
      { seed: 1, iterations: 500 },
    );
    expect(r.intensity.euiPerM2).toBeNull();
    expect(r.intensity.euiPerStudent).toBeNull();
  });

  it("records the factor's source and vintage in the derivation trace", () => {
    const r = runEnergySimulation(
      { readings: fullYear(1000), gridIntensity: factor() },
      { seed: 1, iterations: 100 },
    );
    const step = r.derivation.find((s) => s.label === "Grid intensity applied");
    expect(step?.source).toBe("Test Org — Test grid mix (2025)");
  });

  it("records the seed and iteration count so a report can be regenerated", () => {
    const r = runEnergySimulation(
      { readings: fullYear(1000), gridIntensity: factor() },
      { seed: 4321, iterations: 777 },
    );
    expect(r.seed).toBe(4321);
    expect(r.iterations).toBe(777);
    expect(r.derivation.some((s) => s.detail.includes("4321"))).toBe(true);
  });

  it("rejects invalid input rather than producing a plausible wrong number", () => {
    expect(() =>
      runEnergySimulation({ readings: [], gridIntensity: factor() }, { seed: 1 }),
    ).toThrow(/no readings/);

    expect(() =>
      runEnergySimulation(
        {
          readings: [
            { consumptionKwh: -5, periodStart: "2025-01-01", periodEnd: "2025-12-31" },
          ],
          gridIntensity: factor(),
        },
        { seed: 1 },
      ),
    ).toThrow(/zero or positive/);

    expect(() =>
      runEnergySimulation(
        { readings: fullYear(100), gridIntensity: factor({ value: 0 }) },
        { seed: 1 },
      ),
    ).toThrow(/positive/);

    expect(() =>
      runEnergySimulation(
        { readings: fullYear(100), gridIntensity: factor() },
        { seed: 1, iterations: 0 },
      ),
    ).toThrow(/positive integer/);
  });
});
