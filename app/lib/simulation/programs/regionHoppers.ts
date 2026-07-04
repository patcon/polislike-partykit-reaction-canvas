// Region-hoppers program: users ease between the AGREE / DISAGREE / PASS anchors
// (with jitter), dwelling briefly at each before hopping to another. Same easing
// core as Drift, but targets snap to the vote regions so it reads as deliberate
// voting rather than free wandering.

import type { CursorEvent, SimContext, SimulationProgram } from '../types';
import { createWanderField, type Wanderer, type WanderField } from './_easing';

/** Random offset applied to a chosen anchor, in canvas units (both axes). */
const JITTER = 6;
/** Steps to pause at a region before hopping (~1s at SIM_TICK_MS=50ms). */
const DWELL_TICKS = 20;

const clamp = (n: number): number => Math.max(0, Math.min(100, n));

/**
 * Pick a target near one of the region anchors: choose an anchor uniformly at
 * random, then offset by ±jitter on each axis (clamped to the canvas).
 * @param anchors The region anchor points to choose among.
 * @param rnd Deterministic PRNG in [0, 1).
 * @param jitter Max offset per axis.
 */
export function pickRegionTarget(
  anchors: ReadonlyArray<{ x: number; y: number }>,
  rnd: () => number,
  jitter: number,
): { x: number; y: number } {
  const a = anchors[Math.floor(rnd() * anchors.length)];
  return {
    x: clamp(a.x + (rnd() * 2 - 1) * jitter),
    y: clamp(a.y + (rnd() * 2 - 1) * jitter),
  };
}

/**
 * Create a Region-hoppers program. Emits one `move` per user per tick keyed
 * `sim_<i>`; `teardown` emits a `remove` for each. Deterministic for a given seed.
 */
export function createRegionHoppersProgram(): SimulationProgram {
  let field: WanderField | null = null;
  let count = 0;

  return {
    id: 'region-hoppers-simple',
    label: 'Region-hoppers (simple)',

    init(ctx: SimContext) {
      count = ctx.userCount;
      const anchors = [ctx.regionAnchors.positive, ctx.regionAnchors.negative, ctx.regionAnchors.neutral];
      field = createWanderField({
        count,
        seed: ctx.seed,
        dwell: DWELL_TICKS,
        // Start each user on a region so the first hop reads clearly.
        initial: (i) => ({ ...anchors[i % anchors.length] }),
        pickTarget: (_i, rnd) => pickRegionTarget(anchors, rnd, JITTER),
      });
    },

    tick(): CursorEvent[] {
      if (!field) return [];
      field.step();
      return field.users.map((u: Wanderer, i: number) => ({
        type: 'move',
        position: { x: u.x, y: u.y, timestamp: 0, userId: `sim_${i}` },
      }));
    },

    teardown(): CursorEvent[] {
      return Array.from({ length: count }, (_, i) => ({
        type: 'remove',
        position: { x: 0, y: 0, timestamp: 0, userId: `sim_${i}` },
      }));
    },
  };
}
