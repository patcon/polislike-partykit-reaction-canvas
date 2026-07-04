// Drives a SimulationProgram on a fixed tick loop and forwards its cursor
// events to a SimSink. State machine: idle -> running <-> paused.
//
// The clock is injectable so tests can advance time and fire ticks manually
// (real code uses Date.now/setInterval). Every emitted event is re-stamped with
// the current time: the client prunes a cursor CURSOR_STALE_MS after an event
// unless a newer event with a *different* timestamp arrives, so a heartbeat that
// reused stale timestamps would not keep paused cursors alive.

import { SIM_TICK_MS } from './types';
import type { CursorEvent, SimContext, SimSink, SimulationProgram } from './types';
import { CURSOR_HEARTBEAT_MS } from '../../utils/cursor';

export type SimEngineState = 'idle' | 'running' | 'paused';

/**
 * Time + timer source for the engine, injected so tests can drive it manually.
 * The real implementation delegates to `Date.now` and `setInterval`.
 */
export interface SimEngineClock {
  /** Current wall-clock time in ms. */
  now(): number;
  /** Schedule `fn` every `ms`; returns an opaque handle passed back to clearInterval. */
  setInterval(fn: () => void, ms: number): unknown;
  /** Cancel a timer previously created by setInterval. */
  clearInterval(handle: unknown): void;
}

const realClock: SimEngineClock = {
  now: () => Date.now(),
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (h) => clearInterval(h as ReturnType<typeof setInterval>),
};

/**
 * Runs one {@link SimulationProgram}, emitting its cursor events to a
 * {@link SimSink} on a fixed {@link SIM_TICK_MS} cadence.
 *
 * Lifecycle: `play()` (idle → running), `pause()` (running → paused, freezing
 * cursors but heart-beating them so they aren't pruned), `play()` again to
 * resume, and `stop()` (→ idle, removing all sim cursors). Paused spans are
 * excluded from the program's elapsed time, so a program never "skips ahead"
 * across a pause.
 *
 * @example
 * const engine = new SimulationEngine(driftProgram, socketSink, ctx);
 * engine.play();   // cursors start flowing
 * engine.pause();  // frozen in place, kept alive by heartbeat
 * engine.play();   // resume where it left off
 * engine.stop();   // all sim cursors removed
 */
export class SimulationEngine {
  private state: SimEngineState = 'idle';
  private timer: unknown = null;
  private startWall = 0;
  private pausedAccum = 0;
  private pauseStartWall = 0;
  private lastSimT = 0;
  private lastEmitWall = 0;
  /** Last emitted non-remove events — re-sent as the pause heartbeat. */
  private lastPositions: CursorEvent[] = [];

  /**
   * @param program The motion source to run (generator or recording).
   * @param sink    Where emitted cursor events go (e.g. the room socket).
   * @param ctx     Run parameters: user count, PRNG seed, region anchors.
   * @param clock   Time/timer source; defaults to real `Date.now`/`setInterval`.
   */
  constructor(
    private program: SimulationProgram,
    private sink: SimSink,
    private ctx: SimContext,
    private clock: SimEngineClock = realClock,
  ) {}

  /** Current lifecycle state. */
  getState(): SimEngineState {
    return this.state;
  }

  /**
   * Start the program from idle, or resume it from paused. No-op if already
   * running. On a fresh start the program is re-initialized with `ctx` and the
   * tick loop begins; on resume the paused span is discounted from elapsed time.
   */
  play(): void {
    if (this.state === 'running') return;
    if (this.state === 'paused') {
      this.pausedAccum += this.clock.now() - this.pauseStartWall;
      this.state = 'running';
      return;
    }
    this.program.init(this.ctx);
    const now = this.clock.now();
    this.startWall = now;
    this.pausedAccum = 0;
    this.lastSimT = 0;
    this.lastEmitWall = now;
    this.lastPositions = [];
    this.state = 'running';
    this.timer = this.clock.setInterval(() => this.tick(), SIM_TICK_MS);
  }

  /**
   * Freeze the simulation in place. Cursors stop moving but the tick loop keeps
   * heart-beating their last positions so consumers don't prune them as stale.
   * No-op unless currently running.
   */
  pause(): void {
    if (this.state !== 'running') return;
    this.pauseStartWall = this.clock.now();
    this.state = 'paused';
  }

  /**
   * Stop the run and emit a `remove` for every sim cursor, returning to idle.
   * No-op if already idle. A subsequent `play()` starts a fresh run.
   */
  stop(): void {
    if (this.state === 'idle') return;
    if (this.timer !== null) {
      this.clock.clearInterval(this.timer);
      this.timer = null;
    }
    const teardown = this.program.teardown();
    if (teardown.length) this.sink.emit(this.stamp(teardown));
    this.state = 'idle';
    this.lastPositions = [];
  }

  /**
   * One loop iteration. While running, advances the program by elapsed
   * (pause-adjusted) sim time and emits its events. While paused, re-emits the
   * last positions once per {@link CURSOR_HEARTBEAT_MS} to defeat stale pruning.
   */
  private tick(): void {
    const wall = this.clock.now();
    if (this.state === 'running') {
      const simT = wall - this.startWall - this.pausedAccum;
      const dt = simT - this.lastSimT;
      this.lastSimT = simT;
      const events = this.program.tick(simT, dt);
      if (events.length) {
        const stamped = this.stamp(events);
        this.sink.emit(stamped);
        this.lastEmitWall = wall;
        this.lastPositions = stamped.filter((e) => e.type !== 'remove');
      }
    } else if (this.state === 'paused') {
      if (this.lastPositions.length && wall - this.lastEmitWall >= CURSOR_HEARTBEAT_MS) {
        this.sink.emit(this.stamp(this.lastPositions));
        this.lastEmitWall = wall;
      }
    }
  }

  /**
   * Clone events with a fresh `position.timestamp` (= current time) so consumers
   * treat each emit as a new update and reset their staleness timers.
   * @param events Events to stamp; not mutated.
   * @returns New event objects with updated timestamps.
   */
  private stamp(events: CursorEvent[]): CursorEvent[] {
    const t = this.clock.now();
    return events.map((e) => ({ ...e, position: { ...e.position, timestamp: t } }));
  }
}
