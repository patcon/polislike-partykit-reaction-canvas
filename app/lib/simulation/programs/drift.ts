// Drift / Wander program: users ease toward random targets anywhere on the
// canvas, picking a new one on arrival. Free-roaming organic motion — the
// simulated-human model from the boids spike. See _easing.ts for the core.

import type { CursorEvent, SimContext, SimulationProgram } from '../types';
import { createWanderField, type WanderField } from './_easing';

/** Targets are drawn from [8, 92] on both axes (a margin inside the canvas). */
const TARGET_MIN = 8;
const TARGET_SPAN = 84;

/**
 * Create a Drift program. Emits one `move` per user per tick keyed `sim_<i>`;
 * `teardown` emits a `remove` for each. Deterministic for a given `ctx.seed`.
 */
export function createDriftProgram(): SimulationProgram {
  let field: WanderField | null = null;
  let count = 0;

  return {
    id: 'drift',
    label: 'Drift / Wander',

    init(ctx: SimContext) {
      count = ctx.userCount;
      field = createWanderField({
        count,
        seed: ctx.seed,
        // Deterministic spread of starting points (matches the boids-spike layout).
        initial: (i) => ({ x: 10 + ((i * 37) % 80), y: 10 + ((i * 53) % 80) }),
        // Anywhere on the canvas — the defining trait of Drift vs Region-hoppers.
        pickTarget: (_i, rnd) => ({
          x: TARGET_MIN + rnd() * TARGET_SPAN,
          y: TARGET_MIN + rnd() * TARGET_SPAN,
        }),
      });
    },

    tick(): CursorEvent[] {
      if (!field) return [];
      field.step();
      return field.users.map((u, i) => ({
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
