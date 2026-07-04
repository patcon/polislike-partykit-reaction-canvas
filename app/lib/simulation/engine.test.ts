import { describe, it, expect } from 'vitest';
import { SimulationEngine, type SimEngineClock } from './engine';
import { SIM_TICK_MS } from './types';
import type { CursorEvent, SimContext, SimSink, SimulationProgram } from './types';
import { CURSOR_HEARTBEAT_MS } from '../../utils/cursor';

// Controllable clock: tests advance time and fire the tick manually.
function makeFakeClock() {
  let t = 0;
  let tickFn: (() => void) | null = null;
  const clock: SimEngineClock = {
    now: () => t,
    setInterval: (fn) => { tickFn = fn; return 1; },
    clearInterval: () => { tickFn = null; },
  };
  return {
    clock,
    advance(ms: number) { t += ms; },
    fireTick() { tickFn?.(); },
    isRunning() { return tickFn !== null; },
  };
}

// Records the sim times it was ticked at; emits one move per tick.
function makeFakeProgram() {
  const tickTimes: number[] = [];
  let inits = 0;
  const program: SimulationProgram = {
    id: 'fake',
    label: 'Fake',
    init() { inits += 1; },
    tick(tMs) {
      tickTimes.push(tMs);
      return [{ type: 'move', position: { x: 1, y: 2, timestamp: 0, userId: 'sim_0' } }];
    },
    teardown() {
      return [{ type: 'remove', position: { x: 0, y: 0, timestamp: 0, userId: 'sim_0' } }];
    },
  };
  return { program, tickTimes, get inits() { return inits; } };
}

function makeFakeSink() {
  const batches: CursorEvent[][] = [];
  const sink: SimSink = { emit: (events) => batches.push(events) };
  return { sink, batches };
}

const CTX: SimContext = { userCount: 3, seed: 1, regionAnchors: {} as SimContext['regionAnchors'] };

describe('SimulationEngine lifecycle', () => {
  it('starts idle and initializes + runs the program on play()', () => {
    const c = makeFakeClock();
    const p = makeFakeProgram();
    const s = makeFakeSink();
    const engine = new SimulationEngine(p.program, s.sink, CTX, c.clock);

    expect(engine.getState()).toBe('idle');
    engine.play();
    expect(engine.getState()).toBe('running');
    expect(p.inits).toBe(1);
    expect(c.isRunning()).toBe(true);
  });

  it('emits the program\'s events on each running tick', () => {
    const c = makeFakeClock();
    const p = makeFakeProgram();
    const s = makeFakeSink();
    const engine = new SimulationEngine(p.program, s.sink, CTX, c.clock);
    engine.play();

    c.advance(SIM_TICK_MS); c.fireTick();
    c.advance(SIM_TICK_MS); c.fireTick();

    expect(s.batches).toHaveLength(2);
    expect(s.batches[0][0].position.userId).toBe('sim_0');
  });

  it('stamps every emitted event with the current time', () => {
    const c = makeFakeClock();
    const p = makeFakeProgram();
    const s = makeFakeSink();
    const engine = new SimulationEngine(p.program, s.sink, CTX, c.clock);
    engine.play();

    c.advance(SIM_TICK_MS); c.fireTick();
    expect(s.batches[0][0].position.timestamp).toBe(SIM_TICK_MS);
    c.advance(SIM_TICK_MS); c.fireTick();
    expect(s.batches[1][0].position.timestamp).toBe(2 * SIM_TICK_MS);
  });

  it('excludes paused spans from the program\'s elapsed time', () => {
    const c = makeFakeClock();
    const p = makeFakeProgram();
    const s = makeFakeSink();
    const engine = new SimulationEngine(p.program, s.sink, CTX, c.clock);
    engine.play();

    c.advance(100); c.fireTick();          // simT = 100
    engine.pause();                        // at t=100
    c.advance(900);                        // paused 900ms
    engine.play();                         // resume at t=1000
    c.advance(100); c.fireTick();          // wall=1100, but paused 900 -> simT = 200

    expect(p.tickTimes).toEqual([100, 200]);
  });
});

describe('SimulationEngine pause heartbeat', () => {
  it('re-emits last positions once per heartbeat interval while paused', () => {
    const c = makeFakeClock();
    const p = makeFakeProgram();
    const s = makeFakeSink();
    const engine = new SimulationEngine(p.program, s.sink, CTX, c.clock);
    engine.play();

    c.advance(SIM_TICK_MS); c.fireTick();  // 1 emit (running)
    engine.pause();
    const afterPause = s.batches.length;

    // Ticks before the heartbeat interval elapses: no new emit.
    c.advance(CURSOR_HEARTBEAT_MS - 1); c.fireTick();
    expect(s.batches.length).toBe(afterPause);

    // Once the interval passes: one heartbeat emit re-sending the frozen position.
    c.advance(1); c.fireTick();
    expect(s.batches.length).toBe(afterPause + 1);
    const beat = s.batches[s.batches.length - 1];
    expect(beat[0].type).toBe('move');
    expect(beat[0].position.userId).toBe('sim_0');
  });
});

describe('SimulationEngine stop', () => {
  it('emits teardown removes, stops the timer, and returns to idle', () => {
    const c = makeFakeClock();
    const p = makeFakeProgram();
    const s = makeFakeSink();
    const engine = new SimulationEngine(p.program, s.sink, CTX, c.clock);
    engine.play();
    c.advance(SIM_TICK_MS); c.fireTick();

    engine.stop();
    expect(engine.getState()).toBe('idle');
    expect(c.isRunning()).toBe(false);
    const last = s.batches[s.batches.length - 1];
    expect(last[0].type).toBe('remove');
    expect(last[0].position.userId).toBe('sim_0');
  });

  it('play() is a no-op while already running', () => {
    const c = makeFakeClock();
    const p = makeFakeProgram();
    const s = makeFakeSink();
    const engine = new SimulationEngine(p.program, s.sink, CTX, c.clock);
    engine.play();
    engine.play();
    expect(p.inits).toBe(1);
  });
});
