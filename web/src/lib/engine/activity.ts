/**
 * Generic activity x factor calculation, shared by every module.
 *
 *     emissions = sum over factors f of ( quantity using f  x  factor f )
 *
 * Energy is one factor (grid intensity). Water is two (supply and treatment),
 * waste is one factor per disposal route, vehicle fuel is one per fuel. Each
 * factor is drawn ONCE per iteration and applied to everything that uses it, so
 * two readings priced with the same factor move together — they share one
 * uncertain number — instead of averaging each other's error away.
 *
 * Only factors are uncertain here (Tier 2: the quantity is metered). Which
 * means a zero-uncertainty factor draws nothing from the random stream, exactly
 * as runEnergySimulation always did, so Energy's seeded numbers do not move.
 */

import { analyseCoverageByMeter, type Coverage, type MeterPeriod } from "./coverage";
import { logNormalParams, mulberry32, randomLogNormal } from "./random";
import { summarize, type Distribution } from "./stats";
import type { DerivationStep, Factor } from "./types";

export interface PricedQuantity {
  factor: Factor;
  /** Total quantity (kWh, m3, tonnes, litres...) priced with this factor. */
  quantity: number;
}

/** Monte Carlo over the factors. Returns one emissions sample (kgCO2e) per iteration. */
export function sampleEmissions(
  priced: readonly PricedQuantity[],
  seed: number,
  iterations: number,
): number[] {
  const rng = mulberry32(seed);
  const params = priced.map((p) => ({
    quantity: p.quantity,
    value: p.factor.value,
    ...logNormalParams(p.factor.value, p.factor.uncertaintyPct),
  }));
  const samples = new Array<number>(iterations);
  for (let i = 0; i < iterations; i++) {
    let total = 0;
    for (const p of params) {
      const intensity = p.sigma === 0 ? p.value : randomLogNormal(rng, p.mu, p.sigma);
      total += p.quantity * intensity;
    }
    samples[i] = total;
  }
  return samples;
}

export interface ActivityReading {
  quantity: number;
  periodStart: string;
  periodEnd: string;
  meterId?: string;
  /** Keys into `factors` that price this reading. */
  factorKeys: readonly string[];
}

export interface ActivityInput {
  readings: readonly ActivityReading[];
  factors: Readonly<Record<string, Factor>>;
  /** Unit of `quantity`, e.g. "m3", "tonnes", "litres". */
  quantityUnit: string;
  /** Heading for the first derivation step, e.g. "Water supplied". */
  quantityLabel: string;
  /** Label per factor key, for the derivation trace. */
  factorLabels?: Readonly<Record<string, string>>;
}

export interface ActivityResult {
  emissionsKgCo2e: Distribution;
  totalQuantity: number;
  coverage: Coverage;
  isPartialPeriod: boolean;
  seed: number;
  iterations: number;
  /**
   * CONVENTION: the first step is always the quantity (value + unit), which is
   * how Reports reads it back from a saved report whatever the module.
   */
  derivation: DerivationStep[];
}

export const DEFAULT_ACTIVITY_ITERATIONS = 10_000;

export function runActivitySimulation(
  input: ActivityInput,
  options: { seed: number; iterations?: number },
): ActivityResult {
  const iterations = options.iterations ?? DEFAULT_ACTIVITY_ITERATIONS;
  if (!Number.isInteger(iterations) || iterations < 1) {
    throw new Error(`iterations must be a positive integer, got ${iterations}`);
  }
  if (input.readings.length === 0) throw new Error("runActivitySimulation: no readings supplied");

  // Quantity priced by each factor key, in a stable (sorted) order so the
  // random stream does not depend on the order readings arrived in.
  const qtyByKey = new Map<string, number>();
  for (const r of input.readings) {
    if (!(r.quantity >= 0)) throw new Error(`Quantity must be zero or positive, got ${r.quantity}`);
    if (r.factorKeys.length === 0) throw new Error("A reading has no factor to price it with");
    for (const k of r.factorKeys) {
      if (!input.factors[k]) throw new Error(`No factor supplied for "${k}"`);
      qtyByKey.set(k, (qtyByKey.get(k) ?? 0) + r.quantity);
    }
  }
  const expectedUnit = `kgCO2e/${input.quantityUnit}`;
  for (const [k, f] of Object.entries(input.factors)) {
    if (!(f.value > 0)) throw new Error("A factor must be positive");
    // A factor in kgCO2e per m3 applied to litres would be wrong by a factor of 1000 and look
    // perfectly plausible, so mismatched units are refused rather than trusted.
    if (f.unit !== expectedUnit) {
      throw new Error(`Factor "${k}" is in ${f.unit}, but readings are in ${input.quantityUnit} (expected ${expectedUnit})`);
    }
  }

  const keys = [...qtyByKey.keys()].sort();
  const priced = keys.map((k) => ({ factor: input.factors[k], quantity: qtyByKey.get(k)! }));

  const totalQuantity = input.readings.reduce((a, r) => a + r.quantity, 0);
  const periods: MeterPeriod[] = input.readings.map((r) => ({
    start: r.periodStart,
    end: r.periodEnd,
    meterId: r.meterId,
  }));
  const { overall: coverage } = analyseCoverageByMeter(periods);

  const emissionsKgCo2e = summarize(sampleEmissions(priced, options.seed, iterations));

  const derivation: DerivationStep[] = [
    {
      label: input.quantityLabel,
      detail:
        `${input.readings.length} reading(s) summed, covering ${coverage.coveredDays} days` +
        (coverage.gaps.length > 0 ? ` with ${coverage.gaps.length} gap(s)` : ""),
      value: totalQuantity,
      unit: input.quantityUnit,
      source: "School-submitted readings",
    },
  ];
  for (const k of keys) {
    const f = input.factors[k];
    derivation.push({
      label: `${input.factorLabels?.[k] ?? k} applied`,
      detail:
        (f.uncertaintyPct
          ? `Sampled log-normally, median ${f.value} ${f.unit}, ±${f.uncertaintyPct}% (1σ)`
          : `Applied as a known constant (no uncertainty published)`) +
        ` to ${fmtQty(qtyByKey.get(k)!)} ${input.quantityUnit}`,
      value: f.value,
      unit: f.unit,
      source: `${f.sourceOrg} — ${f.sourceName} (${f.vintageYear})`,
    });
  }
  derivation.push(
    { label: "Simulation", detail: `${iterations.toLocaleString("en-GB")} iterations, seed ${options.seed}` },
    {
      label: "Reported range",
      detail:
        `p10 ${emissionsKgCo2e.p10.toFixed(1)} / median ${emissionsKgCo2e.median.toFixed(1)} / ` +
        `p90 ${emissionsKgCo2e.p90.toFixed(1)} kgCO2e ` +
        `(band ${emissionsKgCo2e.relativeBandPct.toFixed(1)}% of median)`,
      value: emissionsKgCo2e.median,
      unit: "kgCO2e",
    },
  );
  if (coverage.hasOverlap) {
    derivation.push({
      label: "Warning — overlapping periods",
      detail:
        "Two or more readings for the same meter cover the same dates, so this total may double-count. " +
        "Check for a re-issued bill.",
    });
  }

  return {
    emissionsKgCo2e,
    totalQuantity,
    coverage,
    isPartialPeriod: coverage.coverageClass !== "full_year",
    seed: options.seed,
    iterations,
    derivation,
  };
}

function fmtQty(n: number): string {
  return n.toLocaleString("en-GB", { maximumFractionDigits: 3 });
}
