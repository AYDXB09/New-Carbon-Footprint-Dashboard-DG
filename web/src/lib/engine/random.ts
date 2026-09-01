/**
 * Seeded random number generation.
 *
 * Why this is new code rather than a port: the root `app.js` simulation calls
 * Math.random() directly, so its results cannot be reproduced. `reports` stores
 * a simulation_seed precisely so a saved report can be regenerated and audited
 * — which requires a PRNG we can seed. Everything here takes an explicit `rng`,
 * so no function in the engine reaches for global randomness.
 *
 * mulberry32 is a small public-domain 32-bit generator (Tommy Ettinger). It is a
 * standard published algorithm, implemented here from its definition. Quality is
 * more than sufficient for Monte Carlo over a few tens of thousands of draws.
 */

export type Rng = () => number;

/** Deterministic PRNG: the same seed always yields the same sequence. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Standard normal draw via the Box-Muller transform.
 *
 * Both uniforms are rejected at exactly 0, because log(0) is -Infinity. This
 * guard is carried over from the root app.js implementation, which had it right.
 */
export function randomNormal(rng: Rng): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Log-normal draw, parameterised by the mean/sd of the UNDERLYING normal. */
export function randomLogNormal(rng: Rng, mu: number, sigma: number): number {
  return Math.exp(mu + sigma * randomNormal(rng));
}

/** Uniform draw on [min, max). */
export function randomUniform(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

/**
 * Convert a published central value plus a relative uncertainty into log-normal
 * parameters.
 *
 * Log-normal rather than normal because an emission factor is strictly positive
 * and right-skewed; a normal distribution on a factor with wide uncertainty will
 * happily sample negative values, which are not physically meaningful.
 *
 * Parameterised so that:
 *   - the MEDIAN of the distribution is exactly the published value, so the
 *     headline number a school sees is the number its cited source states; and
 *   - the coefficient of variation equals the stated relative uncertainty,
 *     via  sigma = sqrt(ln(1 + cv^2)).
 *
 * A null/zero uncertainty yields sigma = 0, i.e. the factor is treated as known
 * exactly and contributes no spread. That is the correct behaviour for a metered
 * quantity, and it is what makes the tier system produce its band automatically:
 * better data means narrower inputs means a narrower output, with no separate
 * confidence-scoring logic anywhere.
 */
export function logNormalParams(
  value: number,
  uncertaintyPct: number | null | undefined,
): { mu: number; sigma: number } {
  if (value <= 0) {
    throw new Error(`logNormalParams: value must be positive, got ${value}`);
  }
  const cv = (uncertaintyPct ?? 0) / 100;
  if (cv < 0) {
    throw new Error(`logNormalParams: uncertainty must not be negative, got ${uncertaintyPct}`);
  }
  return { mu: Math.log(value), sigma: Math.sqrt(Math.log(1 + cv * cv)) };
}
