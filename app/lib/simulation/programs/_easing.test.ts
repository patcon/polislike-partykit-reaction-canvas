import { describe, it, expect } from 'vitest';
import { createNoise2D } from 'simplex-noise';
import { makePrng, createWanderField, easeInOutCubic, easedProgress, noiseWanderOffset } from './_easing';

describe('easeInOutCubic', () => {
  it('maps 0 to 0 and 1 to 1', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
  });

  it('is symmetric around the midpoint (0.5 -> 0.5)', () => {
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 10);
  });

  it('is monotonically increasing', () => {
    let prev = -Infinity;
    for (let t = 0; t <= 1; t += 0.1) {
      const v = easeInOutCubic(t);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('starts and ends slower than linear (ease-in / ease-out)', () => {
    expect(easeInOutCubic(0.1)).toBeLessThan(0.1);
    expect(easeInOutCubic(0.9)).toBeGreaterThan(0.9);
  });
});

describe('easedProgress', () => {
  it('equals easeInOutCubic of the elapsed/duration fraction', () => {
    expect(easedProgress(500, 0, 1000)).toBeCloseTo(easeInOutCubic(0.5), 10);
  });

  it('clamps before start to 0', () => {
    expect(easedProgress(-50, 0, 1000)).toBe(0);
  });

  it('clamps past the duration to 1', () => {
    expect(easedProgress(5000, 0, 1000)).toBe(1);
  });

  it('reaches exactly 1 at tMs === start + duration', () => {
    expect(easedProgress(1500, 500, 1000)).toBe(1);
  });
});

describe('makePrng', () => {
  it('is deterministic for a seed and differs across seeds', () => {
    const a = makePrng(5);
    const b = makePrng(5);
    const c = makePrng(6);
    const seqA = Array.from({ length: 5 }, () => a());
    const seqB = Array.from({ length: 5 }, () => b());
    const seqC = Array.from({ length: 5 }, () => c());
    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
    for (const n of seqA) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });
});

describe('noiseWanderOffset', () => {
  const noise2D = createNoise2D(makePrng(1));

  it('is deterministic for the same inputs', () => {
    const a = noiseWanderOffset(noise2D, 10, 20, 500, 1, 4);
    const b = noiseWanderOffset(noise2D, 10, 20, 500, 1, 4);
    expect(a).toEqual(b);
  });

  it('returns zero offset when radius is 0', () => {
    const { x, y } = noiseWanderOffset(noise2D, 10, 20, 500, 1, 0);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(0);
  });

  it('bounds each axis offset to +/- radius', () => {
    for (let t = 0; t < 2000; t += 137) {
      const { x, y } = noiseWanderOffset(noise2D, 3, 7, t, 0.8, 5);
      expect(Math.abs(x)).toBeLessThanOrEqual(5);
      expect(Math.abs(y)).toBeLessThanOrEqual(5);
    }
  });

  it('gives distinct offsets for distinct per-user noise streams (different offX/offY)', () => {
    const a = noiseWanderOffset(noise2D, 1, 2, 400, 1, 4);
    const b = noiseWanderOffset(noise2D, 99, 200, 400, 1, 4);
    expect(a).not.toEqual(b);
  });
});

describe('createWanderField dwell', () => {
  // A user parked on its target (initial === target) is always "arrived", so
  // pickTarget cadence directly reveals the dwell spacing.
  function countRetargets(dwell: number, steps: number): number {
    let picks = 0;
    const field = createWanderField({
      count: 1,
      seed: 1,
      dwell,
      initial: () => ({ x: 0, y: 0 }),
      pickTarget: () => { picks += 1; return { x: 0, y: 0 }; },
    });
    for (let i = 0; i < steps; i++) field.step();
    return picks;
  }

  it('retargets every step when dwell is 0 (Drift default)', () => {
    expect(countRetargets(0, 5)).toBe(5);
  });

  it('retargets once per (dwell + 1) steps when dwelling', () => {
    // dwell=3 => pick on steps 1 and 5 within 5 steps.
    expect(countRetargets(3, 5)).toBe(2);
  });
});
