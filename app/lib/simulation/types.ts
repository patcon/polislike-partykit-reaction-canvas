// Core interfaces for the demo-page simulation engine.
//
// A *program* is a source of cursor events over simulated time (both
// programmatic generators and recorded streams implement the same interface).
// The *engine* drives a program on a tick loop and hands its events to a
// *sink*. See docs/specs/simulated-users.md.

import type { CursorEvent } from '../../../party/types';
import type { ReactionAnchors } from '../../utils/voteRegion';

export type { CursorEvent };

/** Engine tick cadence — matches the server's cursor batch window (50ms / 20fps). */
export const SIM_TICK_MS = 50;

/**
 * Read-only context handed to a program at init(). `seed` makes generator
 * motion reproducible for tests; `regionAnchors` lets region-aware programs
 * target AGREE/DISAGREE/PASS.
 */
export interface SimContext {
  /** How many simulated users to drive. */
  userCount: number;
  /** Deterministic PRNG seed (generators must not use Math.random). */
  seed: number;
  /** AGREE/DISAGREE/PASS anchor points, coords 0..100. */
  regionAnchors: ReactionAnchors;
}

/**
 * A selectable simulation program. Generators emit one `move` per user per
 * tick (current position); recordings emit the events whose timestamp falls in
 * the elapsed window. Sim user ids use the `sim_` prefix.
 */
export interface SimulationProgram {
  /** Stable key, e.g. 'drift'. */
  readonly id: string;
  /** Human label for the control-bar dropdown. */
  readonly label: string;
  /** (Re)initialize per-user state for a run. */
  init(ctx: SimContext): void;
  /**
   * Advance to absolute elapsed sim time `tMs` and return the cursor events to
   * emit this tick. `dtMs` is the delta since the previous tick.
   */
  tick(tMs: number, dtMs: number): CursorEvent[];
  /** Cursor events to emit when stopping — a `remove` for every sim user. */
  teardown(): CursorEvent[];
}

/** Consumes cursor events produced by the engine (socket send, local ref, …). */
export interface SimSink {
  emit(events: CursorEvent[]): void;
}
