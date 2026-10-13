import { describe, expect, it } from "vitest";
import type { EmissionFactorRow } from "./energy";
import { STAND_IN_UNCERTAINTY_PCT, engineFactorFor } from "./factorMath";

const row = (over: Partial<EmissionFactorRow> = {}): EmissionFactorRow => ({
  id: "f",
  module: "water",
  factor_key: "supply_intensity",
  used_for: "x",
  value: 0.1913,
  unit: "kgCO2e/m3",
  uncertainty_pct: 25,
  scope: "country",
  country_code: "GB",
  region_countries: null,
  source_name: "Conversion factors 2026",
  source_org: "UK Government (DESNZ)",
  source_url: null,
  vintage_year: 2023,
  ...over,
});

describe("engineFactorFor", () => {
  it("keeps the published uncertainty for a local factor", () => {
    expect(engineFactorFor({ row: row(), standIn: false }).uncertaintyPct).toBe(25);
  });
  it("widens a stand-in to at least the stand-in floor", () => {
    expect(engineFactorFor({ row: row(), standIn: true }).uncertaintyPct).toBe(STAND_IN_UNCERTAINTY_PCT);
  });
  it("never narrows a factor that was already wider than the floor", () => {
    expect(engineFactorFor({ row: row({ uncertainty_pct: 150 }), standIn: true }).uncertaintyPct).toBe(150);
  });
  it("treats a missing published uncertainty as zero, then applies the floor", () => {
    expect(engineFactorFor({ row: row({ uncertainty_pct: null }), standIn: true }).uncertaintyPct).toBe(100);
    expect(engineFactorFor({ row: row({ uncertainty_pct: null }), standIn: false }).uncertaintyPct).toBeNull();
  });
  it("carries the source and vintage through to the derivation", () => {
    expect(engineFactorFor({ row: row(), standIn: true })).toMatchObject({
      sourceOrg: "UK Government (DESNZ)",
      vintageYear: 2023,
      value: 0.1913,
    });
  });
});
