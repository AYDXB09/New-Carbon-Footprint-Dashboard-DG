import { describe, expect, it } from "vitest";
import { logNormalParams, mulberry32, randomLogNormal, randomNormal } from "./random";

describe("mulberry32", () => {
  it("is deterministic — the same seed replays the same sequence", () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seqA = Array.from({ length: 50 }, () => a());
    const seqB = Array.from({ length: 50 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const a = Array.from({ length: 20 }, mulberry32(1));
    const b = Array.from({ length: 20 }, mulberry32(2));
    expect(a).not.toEqual(b);
  });

  it("stays within [0, 1)", () => {
    const rng = mulberry32(99);
    for (let i = 0; i < 5000; i++) {
      const x = rng();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe("randomNormal", () => {
  it("has approximately zero mean and unit variance", () => {
    const rng = mulberry32(7);
    const n = 50_000;
    const xs = Array.from({ length: n }, () => randomNormal(rng));
    const mean = xs.reduce((a, x) => a + x, 0) / n;
    const variance = xs.reduce((a, x) => a + (x - mean) ** 2, 0) / n;
    expect(mean).toBeCloseTo(0, 1);
    expect(variance).toBeCloseTo(1, 1);
  });

  it("never returns a non-finite value (the log(0) guard holds)", () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 20_000; i++) {
      expect(Number.isFinite(randomNormal(rng))).toBe(true);
    }
  });
});

describe("logNormalParams", () => {
  it("puts the distribution median exactly on the published value", () => {
    const value = 0.42;
    const { mu, sigma } = logNormalParams(value, 25);
    const rng = mulberry32(2024);
    const draws = Array.from({ length: 40_000 }, () => randomLogNormal(rng, mu, sigma)).sort(
      (a, b) => a - b,
    );
    const median = draws[Math.floor(draws.length / 2)];
    // Median of a log-normal is exp(mu) by construction; confirm the sampler agrees.
    expect(median).toBeCloseTo(value, 2);
  });

  it("reproduces the requested coefficient of variation", () => {
    const value = 100;
    const uncertaintyPct = 30;
    const { mu, sigma } = logNormalParams(value, uncertaintyPct);
    const rng = mulberry32(555);
    const n = 60_000;
    const xs = Array.from({ length: n }, () => randomLogNormal(rng, mu, sigma));
    const mean = xs.reduce((a, x) => a + x, 0) / n;
    const sd = Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / n);
    expect((sd / mean) * 100).toBeGreaterThan(uncertaintyPct - 3);
    expect((sd / mean) * 100).toBeLessThan(uncertaintyPct + 3);
  });

  it("never samples a negative value, even at wide uncertainty", () => {
    // The reason for choosing log-normal over normal: a factor is strictly
    // positive, and a normal at 60% relative sd would sample below zero.
    const { mu, sigma } = logNormalParams(0.4, 60);
    const rng = mulberry32(11);
    for (let i = 0; i < 30_000; i++) {
      expect(randomLogNormal(rng, mu, sigma)).toBeGreaterThan(0);
    }
  });

  it("collapses to sigma = 0 when no uncertainty is given", () => {
    expect(logNormalParams(0.4, null).sigma).toBe(0);
    expect(logNormalParams(0.4, 0).sigma).toBe(0);
    expect(logNormalParams(0.4, undefined).sigma).toBe(0);
  });

  it("rejects a non-positive value or negative uncertainty", () => {
    expect(() => logNormalParams(0, 10)).toThrow(/positive/);
    expect(() => logNormalParams(-1, 10)).toThrow(/positive/);
    expect(() => logNormalParams(1, -5)).toThrow(/negative/);
  });
});
