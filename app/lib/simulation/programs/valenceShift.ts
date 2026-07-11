// Valence Shift program: users belong to one of N correlated opinion groups,
// sized by Fibonacci ratios — same group model as the "correlated" trace mode
// in docs/pages/valence-onboarding-v3.html. On a fixed interval every group's
// target re-randomizes together; each user glides (eased, like Region-hoppers'
// move phase) directly to a point sampled from its own personal-valence chord
// (see docs/specs/valence-shift-organic-positioning.md), then holds — with a
// small 2D noise wander layered on top, like Region-hoppers' rest phase —
// until the next "valence shift" event.

import { createNoise2D } from 'simplex-noise';
import type { CursorEvent, SimContext, SimulationProgram } from '../types';
import { makePrng, easedProgress, noiseWanderOffset } from './_easing';
import { valenceChordEndpoints, sampleValencePosition, type ReactionAnchors } from '../../../utils/voteRegion';

/** Group-size weights (matches the onboarding v3 prototype's `FIBS`). */
const FIBS = [1, 2, 3, 5, 8, 13, 21];
/** How often group targets re-randomize (ms) — the "valence shift" event. */
export const SHIFT_INTERVAL_MS = 4000;
/** How long a user takes to glide to its new target after a shift (ms). */
export const TRAVEL_DURATION_MS = 2000;
/** Max per-user offset from its group's shared target, re-rolled every shift so members
 *  don't overlap exactly and don't ride the same fixed offset hop after hop. */
const NOISE_SPAN = 0.15;
/** Radius of the 2D micro-wander layered on top of the valence-derived point (canvas units). */
const WANDER_RADIUS = 1.5;
/** Speed the micro-wander noise field advances at. */
const WANDER_SPEED = 0.6;
/**
 * How far a group's members scatter around their shared anchor point on the target-valence
 * chord. Dual-mode, inferred from magnitude — hand-edit to explore:
 *   0 <= SPREAD <= 1 → fraction of chord length (0 = single shared point, 1 = full chord).
 *   SPREAD > 1       → absolute canvas units (0-100 space, open-ended); holds a constant
 *                       scatter footprint as valence gets extreme instead of shrinking toward
 *                       the vertex, falling back to the full chord once it's shorter than this.
 */
const SPREAD = 0.15;

const clampValence = (v: number): number => Math.max(-1, Math.min(1, v));
const clampCoord = (n: number): number => Math.max(0, Math.min(100, n));
const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Resolves `SPREAD` to a 0..1 fraction of a chord of length `chordLen`.
 * `spread <= 1` is already a fraction and passes through unchanged. `spread > 1`
 * is treated as absolute canvas units and divided by the chord's actual length,
 * clamped to 1 (the full chord) — including when `chordLen` is 0 (the chord
 * degenerates to a point at valence ±1, so there's nowhere further to scatter).
 */
export function resolveSpreadFraction(spread: number, chordLen: number): number {
  if (spread <= 1) return spread;
  if (chordLen <= 0) return 1;
  return Math.min(1, spread / chordLen);
}

/**
 * Assign position `i` of `n` to one of `groupCount` groups, sized by
 * Fibonacci ratios — e.g. 3 groups split 1:2:3, so the last group gets half
 * of all users. Mirrors `assignBase()` in valence-onboarding-v3.html.
 */
export function assignGroup(i: number, n: number, groupCount: number): number {
  const weights = FIBS.slice(0, groupCount);
  const total = weights.reduce((a, b) => a + b, 0);
  const pos = (i + 0.5) / n;
  let cum = 0;
  for (let g = 0; g < weights.length; g++) {
    cum += weights[g] / total;
    if (pos < cum) return g;
  }
  return weights.length - 1;
}

/**
 * Create a Valence Shift program. Every group's target re-randomizes together
 * every {@link SHIFT_INTERVAL_MS}; each user then glides (eased, over
 * {@link TRAVEL_DURATION_MS}) from its current canvas position to a point
 * sampled from its own personal-valence chord, scattered around a shared
 * group anchor by `SPREAD`, and holds steady once arrived. Deterministic for
 * a given `ctx.seed`.
 */
export function createValenceShiftProgram(): SimulationProgram {
  let count = 0;
  let anchors: ReactionAnchors;
  let group: number[] = [];
  let noiseOffset: number[] = [];
  let groupTarget: number[] = [];
  let anchorT: number[] = [];
  let travelFromX: number[] = [];
  let travelFromY: number[] = [];
  let travelToX: number[] = [];
  let travelToY: number[] = [];
  let travelStart = 0;
  let rnd: () => number = () => 0;
  let noise2D: (x: number, y: number) => number = () => 0;
  let wanderOffX: number[] = [];
  let wanderOffY: number[] = [];
  let nextShiftAt = SHIFT_INTERVAL_MS;

  /** Reroll every group's target valence, each member's personal offset from it, and each
   *  member's destination point. */
  function pickTargets() {
    groupTarget = groupTarget.map(() => rnd() * 2 - 1);
    anchorT = anchorT.map(() => rnd());
    noiseOffset = noiseOffset.map(() => (rnd() * 2 - 1) * NOISE_SPAN);
    for (let i = 0; i < count; i++) {
      const g = group[i];
      const personalValence = clampValence(groupTarget[g] + noiseOffset[i]);
      const { a, b } = valenceChordEndpoints(personalValence, anchors);
      const chordLen = Math.hypot(b.x - a.x, b.y - a.y);
      const spreadFraction = resolveSpreadFraction(SPREAD, chordLen);
      const memberT = clamp01(anchorT[g] + (rnd() * 2 - 1) * spreadFraction / 2);
      const p = sampleValencePosition(personalValence, memberT, anchors);
      travelToX[i] = p.x;
      travelToY[i] = p.y;
    }
  }

  /** Current eased position (pre-wander) for user `i` at `tMs`, given the active glide. */
  function currentPos(i: number, tMs: number): { x: number; y: number } {
    const e = easedProgress(tMs, travelStart, TRAVEL_DURATION_MS);
    return { x: lerp(travelFromX[i], travelToX[i], e), y: lerp(travelFromY[i], travelToY[i], e) };
  }

  return {
    id: 'valence-shift',
    label: 'Valence Shift (groups)',

    init(ctx: SimContext) {
      count = ctx.userCount;
      anchors = ctx.regionAnchors;
      rnd = makePrng(ctx.seed);
      noise2D = createNoise2D(makePrng(ctx.seed + 1)); // independent seeded stream
      nextShiftAt = SHIFT_INTERVAL_MS;
      travelStart = 0;

      const groupCount = Math.max(1, Math.min(FIBS.length, Math.round(ctx.groupCount ?? 3)));
      groupTarget = new Array(groupCount).fill(0);
      anchorT = new Array(groupCount).fill(0);
      group = Array.from({ length: count }, (_, i) => assignGroup(i, count, groupCount));
      noiseOffset = new Array(count).fill(0);
      travelToX = new Array(count).fill(0);
      travelToY = new Array(count).fill(0);
      pickTargets();
      travelFromX = [...travelToX];
      travelFromY = [...travelToY];
      wanderOffX = Array.from({ length: count }, () => rnd() * 1000);
      wanderOffY = Array.from({ length: count }, () => rnd() * 1000);
    },

    tick(tMs: number): CursorEvent[] {
      if (tMs >= nextShiftAt) {
        nextShiftAt += SHIFT_INTERVAL_MS;
        for (let i = 0; i < count; i++) {
          const cur = currentPos(i, tMs);
          travelFromX[i] = cur.x;
          travelFromY[i] = cur.y;
        }
        travelStart = tMs;
        pickTargets();
      }
      return Array.from({ length: count }, (_, i) => {
        const p = currentPos(i, tMs);
        const wander = noiseWanderOffset(noise2D, wanderOffX[i], wanderOffY[i], tMs, WANDER_SPEED, WANDER_RADIUS);
        return {
          type: 'move',
          position: { x: clampCoord(p.x + wander.x), y: clampCoord(p.y + wander.y), timestamp: 0, userId: `sim_${i}` },
        };
      });
    },

    teardown(): CursorEvent[] {
      return Array.from({ length: count }, (_, i) => ({
        type: 'remove',
        position: { x: 0, y: 0, timestamp: 0, userId: `sim_${i}` },
      }));
    },
  };
}
