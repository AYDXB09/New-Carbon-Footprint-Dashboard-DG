import type { EmissionFactorRow } from "./energy";
import type { Factor } from "./engine/types";

/**
 * When no emission factor exists for a school's own country, a factor published
 * for another country may be offered as a STAND-IN — never applied silently, and
 * never with its home-country precision. The 1-sigma applied is at least this.
 *
 * This number is a modelling assumption, not a published statistic. It is wide on
 * purpose: a UK water or waste factor can be right for Britain and several times
 * off elsewhere (desalinated supply, landfill with no gas capture), and a band of
 * +/-25% would claim a precision nobody has. At 100% the p10-p90 range spans
 * roughly a factor of 3.6 either side of the median, which is closer to "we don't
 * really know" than to a measurement.
 */
export const STAND_IN_UNCERTAINTY_PCT = 100;

export interface ResolvedFactor {
  row: EmissionFactorRow;
  /** True when this factor was published for a different country than the school's. */
  standIn: boolean;
}

export function toEngineFactor(row: EmissionFactorRow): Factor {
  return {
    value: row.value,
    unit: row.unit,
    uncertaintyPct: row.uncertainty_pct,
    sourceName: row.source_name,
    sourceOrg: row.source_org,
    vintageYear: row.vintage_year,
  };
}

/** The factor as the engine should use it, with the stand-in widening applied. */
export function engineFactorFor(resolved: ResolvedFactor): Factor {
  const f = toEngineFactor(resolved.row);
  if (!resolved.standIn) return f;
  return { ...f, uncertaintyPct: Math.max(f.uncertaintyPct ?? 0, STAND_IN_UNCERTAINTY_PCT) };
}
