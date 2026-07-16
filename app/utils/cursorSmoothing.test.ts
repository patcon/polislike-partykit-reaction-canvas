import { describe, expect, it } from 'vitest';
import { stepCursorSmoothing } from './cursorSmoothing';

const config = { stiffness: 0.12, damping: 0.5, mass: 1 };

describe('stepCursorSmoothing', () => {
  it('seeds a new target at its own position with no initial velocity', () => {
    const state = new Map();
    const targets = new Map([['a', { x: 50, y: 50 }]]);
    stepCursorSmoothing(state, targets, config);
    expect(state.get('a')).toMatchObject({ x: 50, y: 50 });
  });

  it('eases toward a moved target rather than snapping to it', () => {
    const state = new Map([['a', { x: 0, y: 0, vx: 0, vy: 0 }]]);
    const targets = new Map([['a', { x: 100, y: 0 }]]);
    stepCursorSmoothing(state, targets, config);
    const s = state.get('a')!;
    expect(s.x).toBeGreaterThan(0);
    expect(s.x).toBeLessThan(100);
  });

  it('converges to the target position over repeated steps', () => {
    const state = new Map([['a', { x: 0, y: 0, vx: 0, vy: 0 }]]);
    const targets = new Map([['a', { x: 100, y: 0 }]]);
    for (let i = 0; i < 200; i++) stepCursorSmoothing(state, targets, config);
    expect(state.get('a')!.x).toBeCloseTo(100, 0);
  });

  it('prunes state for targets that have disappeared', () => {
    const state = new Map([['a', { x: 0, y: 0, vx: 0, vy: 0 }]]);
    stepCursorSmoothing(state, new Map(), config);
    expect(state.has('a')).toBe(false);
  });
});
