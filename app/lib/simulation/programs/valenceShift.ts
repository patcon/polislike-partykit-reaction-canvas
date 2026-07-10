// Valence Shift program: users belong to one of N correlated opinion groups,
// sized by Fibonacci ratios — same group model as the "correlated" trace mode
// in docs/pages/valence-onboarding-v3.html. On a fixed interval every group's
// target re-randomizes together; each user glides to its group's new shared
// target valence over a bounded duration (eased, like Region-hoppers'
// move phase), then holds — with a small 2D noise wander layered on top, like
// Region-hoppers' rest phase — until the next "valence shift" event.

import { createNoise2D } from 'simplex-noise';
import type { CursorEvent, SimContext, SimulationProgram } from '../types';
import { makePrng, easeInOutCubic, noiseWanderOffset } from './_easing';
import { valenceToPosition, type ReactionAnchors } from '../../../utils/voteRegion';

/** Group-size weights (matches the onboarding v3 prototype's `FIBS`). */
const FIBS = [1, 2, 3, 5, 8, 13, 21];
/** How often group targets re-randomize (ms) — the "valence shift" event. */
export const SHIFT_INTERVAL_MS = 4000;
/** How long a user takes to glide to its new target after a shift (ms). */
export const TRAVEL_DURATION_MS = 2000;
/** Max per-user offset from its group's shared target, so members don't overlap exactly. */
const NOISE_SPAN = 0.15;
/** Radius of the 2D micro-wander layered on top of the valence-derived point (canvas units). */
const WANDER_RADIUS = 1.5;
/** Speed the micro-wander noise field advances at. */
const WANDER_SPEED = 0.6;

const clampValence = (v: number): number => Math.max(-1, Math.min(1, v));
const clampCoord = (n: number): number => Math.max(0, Math.min(100, n));

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
 * {@link TRAVEL_DURATION_MS}) from its current valence to its group's new
 * shared target, mapped onto the canvas via `valenceToPosition`, and holds
 * steady once arrived. Deterministic for a given `ctx.seed`.
 */
export function createValenceShiftProgram(): SimulationProgram {
  let count = 0;
  let anchors: ReactionAnchors;
  let group: number[] = [];
  let noiseOffset: number[] = [];
  let value: number[] = [];
  let groupTarget: number[] = [];
  let travelFrom: number[] = [];
  let travelTo: number[] = [];
  let travelStart = 0;
  let rnd: () => number = () => 0;
  let noise2D: (x: number, y: number) => number = () => 0;
  let wanderOffX: number[] = [];
  let wanderOffY: number[] = [];
  let nextShiftAt = SHIFT_INTERVAL_MS;

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
      groupTarget = Array.from({ length: groupCount }, () => rnd() * 2 - 1);
      group = Array.from({ length: count }, (_, i) => assignGroup(i, count, groupCount));
      noiseOffset = Array.from({ length: count }, () => (rnd() * 2 - 1) * NOISE_SPAN);
      value = group.map((g, i) => clampValence(groupTarget[g] + noiseOffset[i]));
      travelFrom = [...value];
      travelTo = [...value];
      wanderOffX = Array.from({ length: count }, () => rnd() * 1000);
      wanderOffY = Array.from({ length: count }, () => rnd() * 1000);
    },

    tick(tMs: number): CursorEvent[] {
      if (tMs >= nextShiftAt) {
        nextShiftAt += SHIFT_INTERVAL_MS;
        groupTarget = groupTarget.map(() => rnd() * 2 - 1);
        travelStart = tMs;
        travelFrom = [...value];
        travelTo = group.map((g, i) => clampValence(groupTarget[g] + noiseOffset[i]));
      }
      const e = easeInOutCubic(Math.max(0, Math.min((tMs - travelStart) / TRAVEL_DURATION_MS, 1)));
      return Array.from({ length: count }, (_, i) => {
        value[i] = travelFrom[i] + (travelTo[i] - travelFrom[i]) * e;
        const p = valenceToPosition(value[i], anchors);
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
