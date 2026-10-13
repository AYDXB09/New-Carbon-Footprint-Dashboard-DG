import { supabase } from "./supabase";
import { getDefaultFactor, type EmissionFactorRow } from "./energy";
import type { ResolvedFactor } from "./factorMath";

export { STAND_IN_UNCERTAINTY_PCT, engineFactorFor, type ResolvedFactor } from "./factorMath";

/**
 * Local factor first (the database's own region-then-recency rule); only if there
 * is none, a flagged stand-in. Null when there is neither.
 */
export async function resolveFactor(
  module: string,
  factorKey: string,
  countryCode: string | null,
): Promise<ResolvedFactor | null> {
  const local = await getDefaultFactor(module, factorKey, countryCode);
  if (local) return { row: local, standIn: false };

  const { data, error } = await supabase
    .from("emission_factors")
    .select("*")
    .eq("module", module)
    .eq("factor_key", factorKey)
    .eq("stand_in_ok", true)
    .is("superseded_by", null)
    .order("vintage_year", { ascending: false })
    .limit(1);
  if (error) {
    if (/stand_in_ok/i.test(error.message)) {
      throw new Error(
        "The emission-factor library for this module has not been loaded yet. Apply migration 0013 in Supabase, then try again.",
      );
    }
    throw error;
  }
  const row = (data?.[0] ?? null) as EmissionFactorRow | null;
  return row ? { row, standIn: true } : null;
}
