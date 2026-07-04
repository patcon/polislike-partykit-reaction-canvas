import { describe, it, expect } from 'vitest';
import { makePrng, createWanderField } from './_easing';

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
