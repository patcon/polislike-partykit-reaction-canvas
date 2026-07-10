import { describe, it, expect } from 'vitest';
import { createValenceShiftProgram, assignGroup, SHIFT_INTERVAL_MS } from './valenceShift';
import type { SimContext } from '../types';
import { DEFAULT_ANCHORS } from '../../../utils/voteRegion';

const CTX: SimContext = { userCount: 20, seed: 42, regionAnchors: DEFAULT_ANCHORS, groupCount: 3 };

describe('assignGroup (Fibonacci group sizing)', () => {
  it('splits a large population into groups sized by Fibonacci ratios (1:2:3 for 3 groups)', () => {
    const n = 6000;
    const counts = [0, 0, 0];
    for (let i = 0; i < n; i++) counts[assignGroup(i, n, 3)] += 1;
    // Weights [1,2,3] over total 6 → expected shares 1/6, 2/6, 3/6.
    expect(counts[0] / n).toBeCloseTo(1 / 6, 1);
    expect(counts[1] / n).toBeCloseTo(2 / 6, 1);
    expect(counts[2] / n).toBeCloseTo(3 / 6, 1);
  });

  it('always returns a valid group index in range', () => {
    for (let i = 0; i < 50; i++) {
      const g = assignGroup(i, 50, 5);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThan(5);
    }
  });
});

describe('valence-shift program', () => {
  it('is deterministic for a fixed seed', () => {
    const a = createValenceShiftProgram(); a.init(CTX);
    const b = createValenceShiftProgram(); b.init(CTX);
    for (let i = 0; i < 400; i++) {
      expect(a.tick(i * 50, 50)).toEqual(b.tick(i * 50, 50));
    }
  });

  it('diverges for a different seed', () => {
    const a = createValenceShiftProgram(); a.init(CTX);
    const b = createValenceShiftProgram(); b.init({ ...CTX, seed: 7 });
    let ea, eb;
    for (let i = 0; i < 200; i++) { ea = a.tick(i * 50, 50); eb = b.tick(i * 50, 50); }
    expect(ea).not.toEqual(eb);
  });

  it('emits one move per user keyed sim_<i>', () => {
    const p = createValenceShiftProgram(); p.init(CTX);
    const ev = p.tick(50, 50);
    expect(ev).toHaveLength(20);
    expect(ev.map((e) => e.position.userId)).toEqual(
      Array.from({ length: 20 }, (_, i) => `sim_${i}`),
    );
    expect(ev.every((e) => e.type === 'move')).toBe(true);
  });

  it('keeps coordinates within 0..100 over a long run', () => {
    const p = createValenceShiftProgram(); p.init(CTX);
    for (let i = 0; i < 600; i++) {
      for (const e of p.tick(i * 50, 50)) {
        expect(e.position.x).toBeGreaterThanOrEqual(0);
        expect(e.position.x).toBeLessThanOrEqual(100);
        expect(e.position.y).toBeGreaterThanOrEqual(0);
        expect(e.position.y).toBeLessThanOrEqual(100);
      }
    }
  });

  it('re-randomizes group targets on a fixed interval, shifting members of the same group together', () => {
    const p = createValenceShiftProgram();
    p.init({ ...CTX, userCount: 6, groupCount: 1 }); // one group → all users share one target
    // Settle near the initial target.
    let last;
    for (let i = 0; i < 100; i++) last = p.tick(i * 50, 50);
    const settled = last!.map((e) => e.position.x);

    // Run well past the hardcoded 8s shift interval.
    let after;
    for (let i = 100; i < 300; i++) after = p.tick(i * 50, 50);
    const shifted = after!.map((e) => e.position.x);

    // All members of the single group moved together, away from where they'd settled.
    const shiftedSpread = Math.max(...shifted) - Math.min(...shifted);
    // Max possible spread from per-user noise alone (±NOISE_SPAN through the
    // steepest valenceToPosition slope) is well under half the canvas width —
    // a single shared group target keeps members clustered, not scattered.
    expect(shiftedSpread).toBeLessThan(20);
    expect(shifted.some((x, i) => Math.abs(x - settled[i]) > 1)).toBe(true); // but it moved
  });

  it('teardown emits a remove for every user', () => {
    const p = createValenceShiftProgram(); p.init(CTX);
    const t = p.teardown();
    expect(t).toHaveLength(20);
    expect(t.every((e) => e.type === 'remove')).toBe(true);
  });

  it('completes a shift as a bounded glide, then holds steady (no perpetual asymptotic creep)', () => {
    const p = createValenceShiftProgram();
    p.init({ ...CTX, userCount: 1, groupCount: 1 });
    let prev: number | undefined;
    let stableTicksAfterFirstShift = 0;
    for (let i = 0; i < 200; i++) {
      const tMs = i * 50;
      const x = p.tick(tMs, 50)[0].position.x;
      // Only count ticks after the first shift — before that, position
      // trivially hasn't moved from its initial value, which would pass
      // even under the old always-creeping algorithm.
      if (prev !== undefined && tMs > SHIFT_INTERVAL_MS && Math.abs(x - prev) < 1e-9) {
        stableTicksAfterFirstShift++;
      }
      prev = x;
    }
    // A duration-based glide holds exactly steady once travel completes; a
    // flat exponential ease keeps moving indefinitely after every shift.
    expect(stableTicksAfterFirstShift).toBeGreaterThan(10);
  });
});
