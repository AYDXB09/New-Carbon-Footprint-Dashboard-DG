/**
 * Summary statistics over a simulated distribution.
 *
 * The percentile function is a direct port of the one in the root app.js — that
 * implementation was correct (linear interpolation between neighbouring ranks)
 * and there was no reason to change it. It is reproduced here with an added
 * guard on empty input and on out-of-range p.
 */

/**
 * Percentile of an ASCENDING-SORTED array, linearly interpolated.
 * Sorting is the caller's responsibility — sorting inside would silently make
 * this O(n log n) per call when the engine needs several percentiles per run.
 */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) throw new Error("percentile: empty input");
  if (p < 0 || p > 100) throw new Error(`percentile: p must be 0-100, got ${p}`);
  if (sorted.length === 1) return sorted[0];

  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (upper >= sorted.length) return sorted[sorted.length - 1];
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export interface Distribution {
  /** Low end of the reported band. */
  p10: number;
  median: number;
  /** High end of the reported band. */
  p90: number;
  mean: number;
  /**
   * Band width as a percentage of the median. This is the visible data-quality
   * signal across every module — a wide band IS the statement that the inputs
   * were rough, so it is computed here rather than left for each UI to derive.
   */
  relativeBandPct: number;
}

/** Summarise raw simulation draws. Input need not be sorted. */
export function summarize(samples: readonly number[]): Distribution {
  if (samples.length === 0) throw new Error("summarize: empty input");
  const sorted = [...samples].sort((a, b) => a - b);
  const median = percentile(sorted, 50);
  const p10 = percentile(sorted, 10);
  const p90 = percentile(sorted, 90);
  const mean = sorted.reduce((acc, x) => acc + x, 0) / sorted.length;
  return {
    p10,
    median,
    p90,
    mean,
    relativeBandPct: median === 0 ? 0 : ((p90 - p10) / median) * 100,
  };
}
