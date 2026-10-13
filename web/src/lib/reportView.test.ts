import { describe, expect, it } from "vitest";
import type { EnergyReportRow } from "./energy";
import type { SchoolRow } from "./school";
import {
  consumptionKwh,
  fmtDate,
  fmtStepValue,
  halfBandPct,
  headline,
  intensities,
  latestPerModule,
  newestFirst,
  nextSteps,
  readDerivation,
} from "./reportView";

function report(over: Partial<EnergyReportRow> = {}): EnergyReportRow {
  return {
    id: "r1",
    school_id: "s1",
    module: "energy",
    generated_at: "2026-10-01T10:00:00Z",
    period_start: "2025-09-01",
    period_end: "2026-08-31",
    coverage: "full_year",
    tier: "tier_2_actual",
    result_p10: 350.6,
    result_median: 397.1,
    result_p90: 451.7,
    simulation_seed: 42,
    simulation_runs: 10000,
    factor_set_version: "f1",
    derivation: {
      steps: [
        { label: "Metered consumption", detail: "1 reading(s)", value: 1109200, unit: "kWh" },
        { label: "Grid intensity applied", detail: "x", value: 0.3582, unit: "kgCO2e/kWh", source: "IEA" },
      ],
      factor: {
        id: "f1",
        scope: "country",
        source_org: "IEA",
        source_name: "Electricity Emission Factors",
        vintage_year: 2025,
        value: 0.3582,
        uncertainty_pct: 10,
      },
    },
    denom_gfa_total_m2: 9000,
    denom_gfa_conditioned_m2: 8000,
    denom_students_total: 600,
    denom_students_boarding: null,
    denom_staff_headcount: null,
    ...over,
  };
}

const school = { country_code: "AE" } as SchoolRow;

describe("headline / band", () => {
  it("returns the three results", () => {
    expect(headline(report())).toEqual({ p10: 350.6, median: 397.1, p90: 451.7 });
  });
  it("is null if any result is missing, never a half-filled range", () => {
    expect(headline(report({ result_p90: null }))).toBeNull();
    expect(headline(report({ result_median: null }))).toBeNull();
  });
  it("half-band is half the p10-p90 width over the median", () => {
    const h = headline(report({ result_p10: 1046, result_median: 1184, result_p90: 1392 }))!;
    expect(halfBandPct(h)).toBeCloseTo(14.6, 1); // the landing sample's own ±14.6%
  });
  it("a zero median does not divide by zero", () => {
    expect(halfBandPct({ p10: 0, median: 0, p90: 0 })).toBe(0);
  });
});

describe("intensities", () => {
  it("divides by the snapshot denominators, not anything else", () => {
    const i = intensities(report());
    expect(i.kgPerM2).toBeCloseTo((397.1 * 1000) / 8000, 6); // 49.6 kgCO2e/m2, as in the README
    expect(i.kgPerStudent).toBeCloseTo((397.1 * 1000) / 600, 6);
    expect(i.kwhPerM2).toBeCloseTo(1109200 / 8000, 6); // 138.65 kWh/m2
  });
  it("is null where a denominator is missing or zero", () => {
    const i = intensities(report({ denom_gfa_conditioned_m2: null, denom_students_total: 0 }));
    expect(i.kgPerM2).toBeNull();
    expect(i.kgPerStudent).toBeNull();
    expect(i.kwhPerM2).toBeNull();
  });
  it("has no kWh/m2 when the derivation carries no consumption step", () => {
    expect(intensities(report({ derivation: null })).kwhPerM2).toBeNull();
  });
});

describe("readDerivation", () => {
  it("reads steps and the factor snapshot", () => {
    const d = readDerivation(report());
    expect(d.steps).toHaveLength(2);
    expect(d.factor).toMatchObject({ sourceOrg: "IEA", vintageYear: 2025, value: 0.3582, uncertaintyPct: 10 });
  });
  it.each([null, undefined, "x", 5, [], { steps: "no", factor: 3 }])("survives junk: %j", (junk) => {
    const d = readDerivation({ derivation: junk });
    expect(d.steps).toEqual([]);
    expect(d.factor).toBeNull();
  });
  it("skips malformed steps but keeps the good ones", () => {
    const d = readDerivation({ derivation: { steps: [null, 4, { detail: "no label" }, { label: "ok", value: "NaN" }] } });
    expect(d.steps).toEqual([{ label: "ok", detail: "", value: undefined, unit: undefined, source: undefined }]);
  });
  it("consumptionKwh needs the kWh-denominated consumption step", () => {
    expect(consumptionKwh(report())).toBe(1109200);
    expect(
      consumptionKwh({ derivation: { steps: [{ label: "Metered consumption", detail: "", value: 5, unit: "m3" }] } }),
    ).toBeNull();
  });
});

describe("ordering", () => {
  const a = report({ id: "a", generated_at: "2026-10-01T10:00:00Z" });
  const b = report({ id: "b", generated_at: "2026-10-03T10:00:00Z" });
  const c = report({ id: "c", module: "water", generated_at: "2026-10-02T10:00:00Z" });
  it("sorts newest first without mutating the input", () => {
    const input = [a, b, c];
    expect(newestFirst(input).map((r) => r.id)).toEqual(["b", "c", "a"]);
    expect(input.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
  it("picks the newest report per module", () => {
    const m = latestPerModule([a, b, c]);
    expect(m.get("energy")?.id).toBe("b");
    expect(m.get("water")?.id).toBe("c");
    expect(m.size).toBe(2);
  });
});

describe("fmtDate", () => {
  it("does not shift the day with the machine's timezone", () => {
    expect(fmtDate("2025-09-01")).toBe("1 Sep 2025");
    expect(fmtDate("2026-01-01")).toBe("1 Jan 2026");
    expect(fmtDate("2026-08-31T23:30:00Z")).toBe("31 Aug 2026");
  });
  it("rejects an impossible month rather than printing undefined", () => {
    expect(fmtDate("2026-13-01")).toBe("2026-13-01");
  });
  it("passes an unparseable value through rather than printing Invalid Date", () => {
    expect(fmtDate("nonsense")).toBe("nonsense");
  });
});

describe("nextSteps", () => {
  it("asks for a first reading when there is no report", () => {
    expect(nextSteps(school, null)).toEqual([{ text: expect.stringContaining("first figure"), to: "/energy" }]);
  });
  it("is empty for a complete full-year report on a school with a country", () => {
    expect(nextSteps(school, report())).toEqual([]);
  });
  it("flags a partial year and points at Energy", () => {
    const s = nextSteps(school, report({ coverage: "partial_year" }));
    expect(s).toHaveLength(1);
    expect(s[0].to).toBe("/energy");
  });
  it("flags missing floor area / students and points at Profile", () => {
    const s = nextSteps(school, report({ denom_gfa_conditioned_m2: null }));
    expect(s).toHaveLength(1);
    expect(s[0].to).toBe("/profile");
  });
  it("flags a missing country", () => {
    const s = nextSteps({ country_code: null } as SchoolRow, report());
    expect(s).toHaveLength(1);
    expect(s[0].text).toContain("country");
  });
});

describe("fmtStepValue", () => {
  it("keeps a factor's precision", () => expect(fmtStepValue(0.3582)).toBe("0.3582"));
  it("drops the .0 on whole numbers", () => expect(fmtStepValue(1109200)).toBe("1,109,200"));
  it("uses one decimal otherwise", () => expect(fmtStepValue(397100.37)).toBe("397,100.4"));
  it("does not print float noise", () => expect(fmtStepValue(0.1 + 0.2)).toBe("0.3"));
});
