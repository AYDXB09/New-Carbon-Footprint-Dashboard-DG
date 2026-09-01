import { describe, expect, it } from "vitest";
import { percentile, summarize } from "./stats";

describe("percentile", () => {
  const sorted = [1, 2, 3, 4, 5];

  it("returns the endpoints at p0 and p100", () => {
    expect(percentile(sorted, 0)).toBe(1);
    expect(percentile(sorted, 100)).toBe(5);
  });

  it("returns the middle value at p50 for odd-length input", () => {
    expect(percentile(sorted, 50)).toBe(3);
  });

  it("interpolates linearly between ranks", () => {
    // index = 0.25 * 3 = 0.75 -> between 10 and 20, three quarters of the way
    expect(percentile([10, 20, 30, 40], 25)).toBeCloseTo(17.5, 10);
  });

  it("handles a single-element array", () => {
    expect(percentile([42], 10)).toBe(42);
    expect(percentile([42], 90)).toBe(42);
  });

  it("rejects empty input and out-of-range percentiles", () => {
    expect(() => percentile([], 50)).toThrow(/empty/);
    expect(() => percentile(sorted, -1)).toThrow(/0-100/);
    expect(() => percentile(sorted, 101)).toThrow(/0-100/);
  });
});

describe("summarize", () => {
  it("sorts its input rather than assuming sorted order", () => {
    const shuffled = summarize([5, 1, 4, 2, 3]);
    const ordered = summarize([1, 2, 3, 4, 5]);
    expect(shuffled).toEqual(ordered);
  });

  it("does not mutate the caller's array", () => {
    const input = [3, 1, 2];
    summarize(input);
    expect(input).toEqual([3, 1, 2]);
  });

  it("reports a zero band for a constant distribution", () => {
    const d = summarize(new Array(1000).fill(7));
    expect(d.p10).toBe(7);
    expect(d.median).toBe(7);
    expect(d.p90).toBe(7);
    expect(d.relativeBandPct).toBe(0);
  });

  it("expresses the band as a percentage of the median", () => {
    const d = summarize(Array.from({ length: 101 }, (_, i) => i)); // 0..100
    expect(d.median).toBeCloseTo(50, 6);
    expect(d.p10).toBeCloseTo(10, 6);
    expect(d.p90).toBeCloseTo(90, 6);
    expect(d.relativeBandPct).toBeCloseTo(160, 6);
  });

  it("avoids dividing by a zero median", () => {
    expect(summarize([0, 0, 0]).relativeBandPct).toBe(0);
  });

  it("rejects empty input", () => {
    expect(() => summarize([])).toThrow(/empty/);
  });
});
