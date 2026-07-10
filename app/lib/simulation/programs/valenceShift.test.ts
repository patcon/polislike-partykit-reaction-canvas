import { describe, it, expect } from 'vitest';
import {
  createValenceShiftProgram,
  assignGroup,
  resolveSpreadFraction,
  SHIFT_INTERVAL_MS,
  TRAVEL_DURATION_MS,
} from './valenceShift';
import type { SimContext } from '../types';
import { DEFAULT_ANCHORS, computeCursorValence } from '../../../utils/voteRegion';

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

  it('does not put every member of a group at the exact same point (chord + spread jitter)', () => {
    const p = createValenceShiftProgram();
    p.init({ ...CTX, userCount: 8, groupCount: 1 });
    let last;
    // Settle well into the hold window of the first shift.
    for (let i = 0; i < 100; i++) last = p.tick(i * 50, 50);
    const xs = last!.map((e) => e.position.x);
    const ys = last!.map((e) => e.position.y);
    const distinctPoints = new Set(xs.map((x, i) => `${x.toFixed(3)},${ys[i].toFixed(3)}`));
    // Chord + non-zero SPREAD jitter means members land at different points on
    // the chord, not all glued to one shared valenceToPosition point.
    expect(distinctPoints.size).toBeGreaterThan(1);
  });

  it('valence stays close to its chord-sampled value while holding, despite micro-wander', () => {
    const p = createValenceShiftProgram();
    p.init({ ...CTX, userCount: 6, groupCount: 3 });
    const atArrival = p
      .tick(TRAVEL_DURATION_MS, 50)
      .map((e) => computeCursorValence(e.position.x, e.position.y, DEFAULT_ANCHORS));
    const startStep = Math.round(TRAVEL_DURATION_MS / 50) + 1;
    const endStep = Math.round(SHIFT_INTERVAL_MS / 50) - 1; // stay inside the hold window
    for (let i = startStep; i < endStep; i++) {
      const ev = p.tick(i * 50, 50);
      ev.forEach((e, idx) => {
        const v = computeCursorValence(e.position.x, e.position.y, DEFAULT_ANCHORS);
        expect(Math.abs(v - atArrival[idx])).toBeLessThan(0.15);
      });
    }
  });

  it('re-scrambles each member\'s personal offset from the group target on every shift, not just the group target itself', () => {
    const p = createValenceShiftProgram();
    p.init({ ...CTX, userCount: 2, groupCount: 1 });
    // Because sampleValencePosition round-trips exactly through computeCursorValence
    // (spread/anchorT only move a point *along* the fixed-valence chord), the valence
    // gap between two same-group users at any settled moment is exactly the gap
    // between their personal offsets — group target cancels out since they share it.
    const gapsByShift: number[] = [];
    let lastRecordedShift = -1;
    const totalShifts = 5;
    for (let tMs = 0; tMs <= totalShifts * SHIFT_INTERVAL_MS; tMs += 50) {
      const ev = p.tick(tMs, 50);
      const shiftIndex = Math.floor(tMs / SHIFT_INTERVAL_MS);
      const sinceShift = tMs % SHIFT_INTERVAL_MS;
      if (shiftIndex > 0 && shiftIndex !== lastRecordedShift && sinceShift > TRAVEL_DURATION_MS + 200) {
        const v0 = computeCursorValence(ev[0].position.x, ev[0].position.y, DEFAULT_ANCHORS);
        const v1 = computeCursorValence(ev[1].position.x, ev[1].position.y, DEFAULT_ANCHORS);
        gapsByShift.push(v0 - v1);
        lastRecordedShift = shiftIndex;
      }
    }
    expect(gapsByShift.length).toBeGreaterThanOrEqual(4);
    // Wander alone perturbs this gap by at most ~0.012 within a hold window (measured);
    // a gap that moves by more than that between shifts means the underlying personal
    // offsets themselves were re-rolled, not just the shared group target.
    const maxDeltaFromFirst = Math.max(...gapsByShift.slice(1).map((g) => Math.abs(g - gapsByShift[0])));
    expect(maxDeltaFromFirst).toBeGreaterThan(0.05);
  });

  it('teardown emits a remove for every user', () => {
    const p = createValenceShiftProgram(); p.init(CTX);
    const t = p.teardown();
    expect(t).toHaveLength(20);
    expect(t.every((e) => e.type === 'remove')).toBe(true);
  });

  it('settles into a small bounded band after the glide window, rather than drifting all the way to the next shift', () => {
    const p = createValenceShiftProgram();
    p.init({ ...CTX, userCount: 1, groupCount: 1 });
    const settledXs: number[] = [];
    for (let i = 0; i < 160; i++) {
      const tMs = i * 50;
      const x = p.tick(tMs, 50)[0].position.x;
      // Sample only the settled portion of the *first* cycle (after its
      // glide completes, before the *second* shift retargets). Sampling
      // across multiple cycles would mix in the difference between
      // unrelated random targets, not measure within-cycle stability.
      if (tMs > SHIFT_INTERVAL_MS + TRAVEL_DURATION_MS && tMs < 2 * SHIFT_INTERVAL_MS) settledXs.push(x);
    }
    const spread = Math.max(...settledXs) - Math.min(...settledXs);
    // A flat exponential ease is still closing a large residual gap well past
    // the glide window's duration; a bounded glide (with only small organic
    // wander layered on top) stays within a tight band once arrived.
    expect(spread).toBeLessThan(10);
  });

  it('adds small organic micro-wander once settled, so position keeps gently varying rather than freezing solid', () => {
    const p = createValenceShiftProgram();
    p.init({ ...CTX, userCount: 1, groupCount: 1 });
    let prev: number | undefined;
    let sawMovement = false;
    for (let i = 0; i < 200; i++) {
      const tMs = i * 50;
      const x = p.tick(tMs, 50)[0].position.x;
      // Well into the hold window (past the glide) — should still be moving,
      // just by a small amount, rather than pixel-frozen.
      const sinceShift = tMs % SHIFT_INTERVAL_MS;
      if (tMs > 0 && sinceShift > TRAVEL_DURATION_MS + 200 && prev !== undefined) {
        if (Math.abs(x - prev) > 1e-6) sawMovement = true;
      }
      prev = x;
    }
    expect(sawMovement).toBe(true);
  });
});

describe('resolveSpreadFraction', () => {
  it('passes proportional spread (<=1) through unchanged, regardless of chord length', () => {
    expect(resolveSpreadFraction(0, 64)).toBe(0);
    expect(resolveSpreadFraction(0.15, 64)).toBe(0.15);
    expect(resolveSpreadFraction(1, 5)).toBe(1);
  });

  it('treats spread >1 as absolute canvas units, dividing by the chord length', () => {
    expect(resolveSpreadFraction(10, 64)).toBeCloseTo(10 / 64, 5);
  });

  it('clamps absolute-unit spread to the full chord once the chord is shorter than it', () => {
    expect(resolveSpreadFraction(10, 5)).toBe(1);
  });

  it('falls back to the full chord for a degenerate (zero-length) chord, without dividing by zero', () => {
    expect(resolveSpreadFraction(10, 0)).toBe(1);
    expect(Number.isFinite(resolveSpreadFraction(10, 0))).toBe(true);
  });

  it('scales monotonically with absolute-unit spread for a fixed chord length, then clamps at 1', () => {
    const chordLen = 64;
    const fractions = [2, 10, 30, 64, 100, 200].map((s) => resolveSpreadFraction(s, chordLen));
    for (let i = 1; i < fractions.length; i++) {
      expect(fractions[i]).toBeGreaterThanOrEqual(fractions[i - 1]);
    }
    expect(fractions[fractions.length - 1]).toBe(1);
  });
});
