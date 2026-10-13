import { supabase } from "./supabase";
import type { CoverageClass } from "./engine/coverage";

export type { CoverageClass };

export type Meter = {
  id: string;
  school_id: string;
  module: string;
  location: string;
  meter_number: string | null;
  /**
   * Which emission factor prices this meter's readings (0013). Null for Energy,
   * which uses the grid factor, and for any meter created before 0013 was applied.
   */
  factor_key?: string | null;
  created_at: string;
  updated_at: string;
};

export type MeterReadingSource = "ai_bill_upload" | "csv_import" | "manual";
export const READING_SOURCE_LABEL: Record<MeterReadingSource, string> = {
  ai_bill_upload: "Bill read by AI",
  csv_import: "CSV import",
  manual: "Typed in",
};

export type MeterReading = {
  id: string;
  school_id: string;
  module: string;
  meter_id: string;
  quantity: number;
  canonical_unit: string;
  period_start: string;
  period_end: string;
  source: MeterReadingSource;
  created_at: string;
};

export type FactorScope = "global" | "region" | "country" | "grid";

export type EmissionFactorRow = {
  id: string;
  module: string;
  factor_key: string;
  used_for: string;
  value: number;
  unit: string;
  uncertainty_pct: number | null;
  scope: FactorScope;
  country_code: string | null;
  region_countries: string[] | null;
  source_name: string;
  source_org: string;
  source_url: string | null;
  vintage_year: number;
};

export type DataTier = "tier_1_estimate" | "tier_2_actual" | "tier_3_granular";

export type EnergyReportRow = {
  id: string;
  school_id: string;
  module: string;
  generated_at: string;
  period_start: string;
  period_end: string;
  coverage: CoverageClass;
  tier: DataTier;
  result_p10: number | null;
  result_median: number | null;
  result_p90: number | null;
  simulation_seed: number | null;
  simulation_runs: number;
  factor_set_version: string;
  derivation: unknown;
  denom_gfa_total_m2: number | null;
  denom_gfa_conditioned_m2: number | null;
  denom_students_total: number | null;
  denom_students_boarding: number | null;
  denom_staff_headcount: number | null;
};

// ---------------------------------------------------------------------------
// Meters
// ---------------------------------------------------------------------------

export async function listMeters(schoolId: string, module: string): Promise<Meter[]> {
  const { data, error } = await supabase
    .from("meters")
    .select("*")
    .eq("school_id", schoolId)
    .eq("module", module)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Meter[];
}

export async function createMeter(
  schoolId: string,
  module: string,
  location: string,
  meterNumber: string | null,
  factorKey?: string | null,
): Promise<Meter> {
  const { data, error } = await supabase
    .from("meters")
    // factor_key is only sent when there is one, so Energy keeps working on a
    // database that has not had 0013 applied yet.
    .insert({
      school_id: schoolId,
      module,
      location,
      meter_number: meterNumber,
      ...(factorKey ? { factor_key: factorKey } : {}),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Meter;
}

export async function updateMeter(
  id: string,
  patch: { location: string; meter_number: string | null; factor_key?: string | null },
): Promise<Meter> {
  const { data, error } = await supabase
    .from("meters")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Meter;
}

// ---------------------------------------------------------------------------
// Readings (meter_log)
// ---------------------------------------------------------------------------

export async function listReadings(meterId: string): Promise<MeterReading[]> {
  const { data, error } = await supabase
    .from("meter_log")
    .select("*")
    .eq("meter_id", meterId)
    .order("period_start", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MeterReading[];
}

export async function createReading(input: {
  schoolId: string;
  module: string;
  meterId: string;
  quantity: number;
  periodStart: string;
  periodEnd: string;
}): Promise<MeterReading> {
  const { data, error } = await supabase
    .from("meter_log")
    .insert({
      school_id: input.schoolId,
      module: input.module,
      meter_id: input.meterId,
      quantity: input.quantity,
      canonical_unit: "kWh",
      period_start: input.periodStart,
      period_end: input.periodEnd,
      source: "manual" as MeterReadingSource,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as MeterReading;
}

/**
 * Overwrites the one reading this slice supports, rather than inserting a
 * second row — multi-reading meters are a real, designed feature (CSV import,
 * monthly granularity) but out of scope here. "Edit" corrects a mistake in
 * the one reading logged, it doesn't start building a real history.
 */
export async function updateReading(
  id: string,
  patch: { quantity: number; period_start: string; period_end: string },
): Promise<MeterReading> {
  const { data, error } = await supabase
    .from("meter_log")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as MeterReading;
}

// ---------------------------------------------------------------------------
// Emission factors
// ---------------------------------------------------------------------------

/**
 * Calls default_emission_factor() (0007/0009) rather than reimplementing the
 * region-match-then-recency rule in the frontend — one place that decides
 * what "the" factor is, not two that can drift apart.
 */
export async function getDefaultFactor(
  module: string,
  factorKey: string,
  countryCode: string | null,
): Promise<EmissionFactorRow | null> {
  const { data, error } = await supabase.rpc("default_emission_factor", {
    p_module: module,
    p_factor_key: factorKey,
    p_country_code: countryCode,
  });
  if (error) throw error;
  // default_emission_factor() returns a single `emission_factors` row, not a
  // SETOF — when its query matches nothing, a SQL function like this returns
  // NULL outright, which PostgREST reports as `data: null`, not an object of
  // null fields.
  if (!data) return null;
  return data as EmissionFactorRow;
}

/**
 * Every factor genuinely applicable to this school+country, for the "Why
 * this number?" picker — same applicability rule as default_emission_factor(),
 * reproduced here only to populate a list of real alternatives; the number
 * that actually gets SAVED always comes from the RPC above, never from this.
 */
export async function listFactorCandidates(
  module: string,
  factorKey: string,
  countryCode: string | null,
): Promise<EmissionFactorRow[]> {
  const { data, error } = await supabase
    .from("emission_factors")
    .select("*")
    .eq("module", module)
    .eq("factor_key", factorKey)
    .is("superseded_by", null);
  if (error) throw error;

  const scopeRank: Record<FactorScope, number> = { grid: 0, country: 1, region: 2, global: 3 };
  return ((data ?? []) as EmissionFactorRow[])
    .filter((f) => {
      if (f.scope === "global") return true;
      if (countryCode == null) return false;
      if (f.scope === "region") return (f.region_countries ?? []).includes(countryCode);
      return f.country_code === countryCode; // country | grid
    })
    .sort((a, b) => scopeRank[a.scope] - scopeRank[b.scope] || b.vintage_year - a.vintage_year);
}

export { toEngineFactor } from "./factorMath";

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export async function createReport(input: {
  schoolId: string;
  module: string;
  periodStart: string;
  periodEnd: string;
  coverage: CoverageClass;
  tier: DataTier;
  resultP10: number;
  resultMedian: number;
  resultP90: number;
  seed: number;
  iterations: number;
  factorSetVersion: string;
  derivation: unknown;
  denominators: {
    gfaTotalM2: number | null;
    gfaConditionedM2: number | null;
    studentsTotal: number | null;
    studentsBoarding: number | null;
    staffHeadcount: number | null;
  };
}): Promise<EnergyReportRow> {
  const { data, error } = await supabase
    .from("reports")
    .insert({
      school_id: input.schoolId,
      module: input.module,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      coverage: input.coverage,
      tier: input.tier,
      result_p10: input.resultP10,
      result_median: input.resultMedian,
      result_p90: input.resultP90,
      simulation_seed: input.seed,
      simulation_runs: input.iterations,
      factor_set_version: input.factorSetVersion,
      derivation: input.derivation,
      denom_gfa_total_m2: input.denominators.gfaTotalM2,
      denom_gfa_conditioned_m2: input.denominators.gfaConditionedM2,
      denom_students_total: input.denominators.studentsTotal,
      denom_students_boarding: input.denominators.studentsBoarding,
      denom_staff_headcount: input.denominators.staffHeadcount,
      denom_captured_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as EnergyReportRow;
}

export async function getLatestReport(
  schoolId: string,
  module: string,
): Promise<EnergyReportRow | null> {
  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .eq("school_id", schoolId)
    .eq("module", module)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as EnergyReportRow | null;
}

/**
 * Records that this school reports Energy at Tier 2 — the breadth/depth badge
 * state (0001's school_modules table), otherwise never written by anything.
 */
export async function markModuleEnabled(
  schoolId: string,
  module: string,
  tier: DataTier,
): Promise<void> {
  const { error } = await supabase
    .from("school_modules")
    .upsert(
      { school_id: schoolId, module, enabled: true, current_tier: tier },
      { onConflict: "school_id,module" },
    );
  if (error) throw error;
}
