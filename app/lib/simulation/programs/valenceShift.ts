// Valence Shift program: users belong to one of N correlated opinion groups,
// sized by Fibonacci ratios — same group model as the "correlated" trace mode
// in docs/pages/valence-onboarding-v3.html. Each user eases toward its group's
// shared target valence; on a fixed interval every group's target
// re-randomizes together, reading as a "valence shift" event.

import type { CursorEvent, SimContext, SimulationProgram } from '../types';
import { makePrng } from './_easing';
import { valenceToPosition, type ReactionAnchors } from '../../../utils/voteRegion';

/** Group-size weights (matches the onboarding v3 prototype's `FIBS`). */
const FIBS = [1, 2, 3, 5, 8, 13, 21];
/** How often group targets re-randomize (ms) — the "valence shift" event. */
const SHIFT_INTERVAL_MS = 4000;
/** Per-tick easing fraction toward the group target (drift speed). */
const DRIFT_EASE = 0.03;
/** Max per-user offset from its group's shared target, so members don't overlap exactly. */
const NOISE_SPAN = 0.15;

const clampValence = (v: number): number => Math.max(-1, Math.min(1, v));

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
 * Create a Valence Shift program. Users ease toward a shared per-group target
 * valence, mapped onto the canvas via `valenceToPosition`; every group's
 * target re-randomizes together every {@link SHIFT_INTERVAL_MS}. Deterministic
 * for a given `ctx.seed`.
 */
export function createValenceShiftProgram(): SimulationProgram {
  let count = 0;
  let anchors: ReactionAnchors;
  let group: number[] = [];
  let noiseOffset: number[] = [];
  let value: number[] = [];
  let groupTarget: number[] = [];
  let rnd: () => number = () => 0;
  let elapsed = 0;

  return {
    id: 'valence-shift',
    label: 'Valence Shift (groups)',

    init(ctx: SimContext) {
      count = ctx.userCount;
      anchors = ctx.regionAnchors;
      rnd = makePrng(ctx.seed);
      elapsed = 0;

      const groupCount = Math.max(1, Math.min(FIBS.length, Math.round(ctx.groupCount ?? 3)));
      groupTarget = Array.from({ length: groupCount }, () => rnd() * 2 - 1);
      group = Array.from({ length: count }, (_, i) => assignGroup(i, count, groupCount));
      noiseOffset = Array.from({ length: count }, () => (rnd() * 2 - 1) * NOISE_SPAN);
      value = group.map((g, i) => clampValence(groupTarget[g] + noiseOffset[i]));
    },

    tick(_tMs: number, dtMs: number): CursorEvent[] {
      elapsed += dtMs;
      if (elapsed >= SHIFT_INTERVAL_MS) {
        elapsed -= SHIFT_INTERVAL_MS;
        groupTarget = groupTarget.map(() => rnd() * 2 - 1);
      }
      return Array.from({ length: count }, (_, i) => {
        const target = clampValence(groupTarget[group[i]] + noiseOffset[i]);
        value[i] += (target - value[i]) * DRIFT_EASE;
        const p = valenceToPosition(value[i], anchors);
        return {
          type: 'move',
          position: { x: p.x, y: p.y, timestamp: 0, userId: `sim_${i}` },
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
