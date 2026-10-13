/**
 * Energy module calculation.
 *
 * NOTE ON PROVENANCE: this is not a port. The root `app.js` engine models
 * DIGITAL activity (device hours, Zoom, Canvas, third-party tools) and contains
 * no energy maths at all; what carried over from it is the statistical
 * machinery in ./random.ts and ./stats.ts, not this file. The prior-art
 * `school-carbon-tool` is client-owned and was not used as a source.
 *
 * Scope, deliberately narrow for now: Tier 2 (metered consumption), full-year
 * coverage, one energy carrier. Tier 1 estimation from a floor-area benchmark
 * and Tier 3 multi-meter granularity both fit this shape and are noted below.
 *
 * The model:
 *
 *     emissions (kgCO2e) = consumption (kWh) x grid intensity (kgCO2e/kWh)
 *
 * Only the factor is uncertain at Tier 2 — metered consumption is a reading, not
 * an estimate — so the output band is driven entirely by how well the grid
 * intensity for that school's region is known. That is the tier system working
 * mechanically rather than through a separate confidence score: at Tier 1 the
 * consumption term becomes an estimate with its own uncertainty, and the band
 * widens on its own.
 */

import { sampleEmissions } from "./activity";
import { analyseCoverageByMeter, type Coverage, type MeterPeriod } from "./coverage";
import { summarize, type Distribution } from "./stats";
import type { DerivationStep, Factor } from "./types";

export type { DerivationStep, Factor };

/** One meter reading, already converted to canonical units at entry. */
export interface EnergyReading {
  consumptionKwh: number;
  periodStart: string;
  periodEnd: string;
  meterLocation?: string;
  /**
   * Which meter this reading belongs to. Coverage is judged per meter, so two
   * meters covering the same months are not flagged as double-counting. Omit
   * for a single-meter school.
   */
  meterId?: string;
}

/** Denominators, snapshot onto the report so intensities stay recomputable. */
export interface Denominators {
  gfaConditionedM2?: number | null;
  studentsTotal?: number | null;
}

export interface EnergyInput {
  readings: readonly EnergyReading[];
  gridIntensity: Factor;
  denominators?: Denominators;
}

export interface SimulationOptions {
  /** Required — a report must be reproducible from its stored seed. */
  seed: number;
  iterations?: number;
}

export interface EnergyResult {
  emissionsKgCo2e: Distribution;
  totalConsumptionKwh: number;
  coverage: Coverage;
  /** Median-based intensities. Null when the denominator is unknown. */
  intensity: {
    /** kWh per m2 of CONDITIONED floor area per year. */
    euiPerM2: number | null;
    /** kWh per student per year. */
    euiPerStudent: number | null;
    /** kgCO2e per m2 of conditioned floor area per year. */
    emissionsPerM2: number | null;
  };
  /**
   * True when coverage is below a full year, i.e. the intensities above are
   * for the covered period only and have NOT been annualised. Annualising a
   * partial year needs a seasonal shape factor, which requires peer data that
   * does not exist yet — so this returns honest un-annualised figures and flags
   * them rather than silently scaling by 12/n.
   */
  isPartialPeriod: boolean;
  seed: number;
  iterations: number;
  derivation: DerivationStep[];
}

export const DEFAULT_ITERATIONS = 10_000;

export function runEnergySimulation(
  input: EnergyInput,
  options: SimulationOptions,
): EnergyResult {
  const iterations = options.iterations ?? DEFAULT_ITERATIONS;
  if (!Number.isInteger(iterations) || iterations < 1) {
    throw new Error(`iterations must be a positive integer, got ${iterations}`);
  }
  if (input.readings.length === 0) {
    throw new Error("runEnergySimulation: no readings supplied");
  }
  for (const r of input.readings) {
    if (!(r.consumptionKwh >= 0)) {
      throw new Error(`Consumption must be zero or positive, got ${r.consumptionKwh}`);
    }
  }
  if (input.gridIntensity.value <= 0) {
    throw new Error("Grid intensity must be positive");
  }

  const totalConsumptionKwh = input.readings.reduce((a, r) => a + r.consumptionKwh, 0);

  const periods: MeterPeriod[] = input.readings.map((r) => ({
    start: r.periodStart,
    end: r.periodEnd,
    meterId: r.meterId,
  }));
  const { overall: coverage } = analyseCoverageByMeter(periods);

  // Sample the factor, not the reading: at Tier 2 the kWh figure is metered.
  const emissionsKgCo2e = summarize(
    sampleEmissions(
      [{ factor: input.gridIntensity, quantity: totalConsumptionKwh }],
      options.seed,
      iterations,
    ),
  );

  const gfa = input.denominators?.gfaConditionedM2 ?? null;
  const students = input.denominators?.studentsTotal ?? null;

  const intensity = {
    euiPerM2: gfa && gfa > 0 ? totalConsumptionKwh / gfa : null,
    euiPerStudent: students && students > 0 ? totalConsumptionKwh / students : null,
    emissionsPerM2: gfa && gfa > 0 ? emissionsKgCo2e.median / gfa : null,
  };

  const factorSource =
    `${input.gridIntensity.sourceOrg} — ${input.gridIntensity.sourceName} ` +
    `(${input.gridIntensity.vintageYear})`;

  const derivation: DerivationStep[] = [
    {
      label: "Metered consumption",
      detail:
        `${input.readings.length} reading(s) summed, covering ${coverage.coveredDays} days` +
        (coverage.gaps.length > 0 ? ` with ${coverage.gaps.length} gap(s)` : ""),
      value: totalConsumptionKwh,
      unit: "kWh",
      source: "School-submitted meter readings",
    },
    {
      label: "Grid intensity applied",
      detail:
        input.gridIntensity.uncertaintyPct
          ? `Sampled log-normally, median ${input.gridIntensity.value} ${input.gridIntensity.unit}, ` +
            `±${input.gridIntensity.uncertaintyPct}% (1σ)`
          : `Applied as a known constant (no uncertainty published)`,
      value: input.gridIntensity.value,
      unit: input.gridIntensity.unit,
      source: factorSource,
    },
    {
      label: "Simulation",
      detail: `${iterations.toLocaleString()} iterations, seed ${options.seed}`,
    },
    {
      label: "Reported range",
      detail:
        `p10 ${emissionsKgCo2e.p10.toFixed(1)} / median ${emissionsKgCo2e.median.toFixed(1)} / ` +
        `p90 ${emissionsKgCo2e.p90.toFixed(1)} kgCO2e ` +
        `(band ${emissionsKgCo2e.relativeBandPct.toFixed(1)}% of median)`,
      value: emissionsKgCo2e.median,
      unit: "kgCO2e",
    },
  ];

  if (coverage.hasOverlap) {
    derivation.push({
      label: "Warning — overlapping periods",
      detail:
        "Two or more readings for the same meter cover the same dates. Consumption has been " +
        "summed as submitted, so this total may double-count. Check for a re-issued bill.",
    });
  }

  return {
    emissionsKgCo2e,
    totalConsumptionKwh,
    coverage,
    intensity,
    isPartialPeriod: coverage.coverageClass !== "full_year",
    seed: options.seed,
    iterations,
    derivation,
  };
}
