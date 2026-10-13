// Pure read-side helpers for the Dashboard and Reports pages. Nothing here
// touches the network or the DOM, so every rule the two pages rely on is
// covered by reportView.test.ts instead of only by looking at a screen.

import type { CoverageClass, DataTier, EnergyReportRow } from "./energy";
import type { SchoolRow } from "./school";

export type CategoryKey = "energy" | "water" | "transportation" | "digital" | "waste";

export type Category = {
  key: CategoryKey;
  label: string;
  /** CSS custom properties defined once in Landing.css's :root. */
  colour: string;
  tint: string;
  /** True when a page and engine exist for it. */
  built: boolean;
};

export const CATEGORIES: readonly Category[] = [
  { key: "energy", label: "Energy", colour: "var(--lp-amber)", tint: "var(--lp-amber-t)", built: true },
  { key: "water", label: "Water", colour: "var(--lp-sky)", tint: "var(--lp-sky-t)", built: false },
  { key: "transportation", label: "Transportation", colour: "var(--lp-coral)", tint: "var(--lp-coral-t)", built: false },
  { key: "digital", label: "Digital", colour: "var(--lp-violet)", tint: "var(--lp-violet-t)", built: false },
  { key: "waste", label: "Waste & food", colour: "var(--lp-moss)", tint: "var(--lp-moss-t)", built: false },
];

export function categoryFor(module: string): Category {
  return CATEGORIES.find((c) => c.key === module) ?? CATEGORIES[0];
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function fmt(n: number, d = 1): string {
  return n.toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
}

/**
 * A derivation-step value: small numbers (factors like 0.3582) keep their
 * precision, whole numbers drop a pointless ".0", everything else gets one
 * decimal.
 */
export function fmtStepValue(v: number): string {
  if (Math.abs(v) < 10) return String(Math.round(v * 10_000) / 10_000);
  return Number.isInteger(v) ? fmt(v, 0) : fmt(v, 1);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "2025-09-01" -> "1 Sep 2025". Built from the string, not a Date, so neither
 * the machine's timezone nor its locale data (en-GB prints "Sept" in newer ICU)
 * can change the output.
 */
export function fmtDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return iso;
  return `${Number(m[3])} ${month} ${m[1]}`;
}

export function fmtPeriod(r: Pick<EnergyReportRow, "period_start" | "period_end">): string {
  return `${fmtDate(r.period_start)} → ${fmtDate(r.period_end)}`;
}

export function coverageLabel(c: CoverageClass): string {
  if (c === "full_year") return "Full year";
  if (c === "partial_year") return "Partial year";
  return "Spot check";
}

export function tierLabel(t: DataTier): string {
  if (t === "tier_1_estimate") return "Tier 1 · Exploratory";
  if (t === "tier_3_granular") return "Tier 3 · Granular";
  return "Tier 2 · Actual";
}

// ---------------------------------------------------------------------------
// Reading a report row
// ---------------------------------------------------------------------------

export type Headline = { p10: number; median: number; p90: number };

/** Null when any of the three results is missing — a half-filled range is not shown. */
export function headline(r: EnergyReportRow): Headline | null {
  if (r.result_p10 == null || r.result_median == null || r.result_p90 == null) return null;
  return { p10: r.result_p10, median: r.result_median, p90: r.result_p90 };
}

/** Half the p10–p90 width as a percentage of the median — the "±" figure. */
export function halfBandPct(h: Headline): number {
  return h.median === 0 ? 0 : ((h.p90 - h.p10) / 2 / h.median) * 100;
}

/**
 * Emissions intensities worked out from the report's own snapshot of the
 * school's size (0008), never from today's profile — so a corrected floor-area
 * figure later does not silently rewrite last year's intensity.
 */
export function intensities(r: EnergyReportRow): {
  kgPerM2: number | null;
  kgPerStudent: number | null;
  kwhPerM2: number | null;
} {
  const h = headline(r);
  const kg = h ? h.median * 1000 : null;
  const gfa = r.denom_gfa_conditioned_m2;
  const students = r.denom_students_total;
  const kwh = consumptionKwh(r);
  return {
    kgPerM2: kg != null && gfa != null && gfa > 0 ? kg / gfa : null,
    kgPerStudent: kg != null && students != null && students > 0 ? kg / students : null,
    kwhPerM2: kwh != null && gfa != null && gfa > 0 ? kwh / gfa : null,
  };
}

export type DerivationStepView = {
  label: string;
  detail: string;
  value?: number;
  unit?: string;
  source?: string;
};

export type FactorSnapshot = {
  id: string | null;
  scope: string | null;
  sourceOrg: string | null;
  sourceName: string | null;
  vintageYear: number | null;
  value: number | null;
  uncertaintyPct: number | null;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** `derivation` is a loose jsonb column; read it defensively rather than trusting its shape. */
export function readDerivation(r: Pick<EnergyReportRow, "derivation">): {
  steps: DerivationStepView[];
  factor: FactorSnapshot | null;
} {
  const d = r.derivation;
  if (!isRecord(d)) return { steps: [], factor: null };

  const steps: DerivationStepView[] = [];
  if (Array.isArray(d.steps)) {
    for (const s of d.steps) {
      if (!isRecord(s)) continue;
      const label = str(s.label);
      if (!label) continue;
      steps.push({
        label,
        detail: str(s.detail) ?? "",
        value: num(s.value) ?? undefined,
        unit: str(s.unit) ?? undefined,
        source: str(s.source) ?? undefined,
      });
    }
  }

  let factor: FactorSnapshot | null = null;
  if (isRecord(d.factor)) {
    factor = {
      id: str(d.factor.id),
      scope: str(d.factor.scope),
      sourceOrg: str(d.factor.source_org),
      sourceName: str(d.factor.source_name),
      vintageYear: num(d.factor.vintage_year),
      value: num(d.factor.value),
      uncertaintyPct: num(d.factor.uncertainty_pct),
    };
  }
  return { steps, factor };
}

/** Total metered kWh, from the engine's first derivation step. */
export function consumptionKwh(r: Pick<EnergyReportRow, "derivation">): number | null {
  const step = readDerivation(r).steps.find((s) => s.label === "Metered consumption" && s.unit === "kWh");
  return step?.value ?? null;
}

// ---------------------------------------------------------------------------
// Picking and ordering reports
// ---------------------------------------------------------------------------

/** Newest first. Does not mutate its input. */
export function newestFirst(reports: readonly EnergyReportRow[]): EnergyReportRow[] {
  return [...reports].sort((a, b) => b.generated_at.localeCompare(a.generated_at));
}

/** The most recently generated report for each module. */
export function latestPerModule(reports: readonly EnergyReportRow[]): Map<string, EnergyReportRow> {
  const out = new Map<string, EnergyReportRow>();
  for (const r of newestFirst(reports)) if (!out.has(r.module)) out.set(r.module, r);
  return out;
}

// ---------------------------------------------------------------------------
// What to suggest next
// ---------------------------------------------------------------------------

export type NextStep = { text: string; to: string };

/**
 * Concrete, grounded nudges only — each one names a real gap in this school's
 * data. Returns nothing rather than padding the list with generic advice.
 */
export function nextSteps(school: SchoolRow, latestEnergy: EnergyReportRow | null): NextStep[] {
  const steps: NextStep[] = [];

  if (!latestEnergy) {
    steps.push({ text: "Log a meter reading to get your first figure.", to: "/energy" });
  } else {
    if (latestEnergy.coverage !== "full_year") {
      steps.push({
        text:
          latestEnergy.coverage === "partial_year"
            ? "The energy reading covers part of a year and is not scaled up. Add the missing months."
            : "The energy reading is a short spot check. Add a full year of readings.",
        to: "/energy",
      });
    }
    const i = intensities(latestEnergy);
    if (i.kgPerM2 == null || i.kgPerStudent == null) {
      steps.push({
        text: "Add floor area and student numbers to see emissions per m² and per student.",
        to: "/profile",
      });
    }
  }

  if (!school.country_code) {
    steps.push({
      text: "Set the school's country so the right grid emission factor is chosen.",
      to: "/profile",
    });
  }
  return steps;
}
