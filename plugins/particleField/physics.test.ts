import { describe, expect, it } from 'vitest';
import { applyPairwiseForces, computeCoeffMatrix, integrateParticles } from './physics';
import type { Params, Particle } from './types';

const baseParams: Params = {
  forceScale: 100,
  proximityRange: 0.5,
  invert: false,
  coreRadius: 10,
  falloff: 100,
  friction: 0,
  maxSpeed: 1000,
  centerGravity: 0,
  multiplier: 1,
};

describe('computeCoeffMatrix', () => {
  it('gives max attraction between a cursor and itself', () => {
    const cursors = new Map([['a', { x: 0.5, y: 0.5 }]]);
    const m = computeCoeffMatrix(cursors, baseParams);
    expect(m.get('a')!.get('a')).toBeCloseTo(baseParams.forceScale);
  });

  it('gives negative coefficient for cursors beyond proximityRange', () => {
    const cursors = new Map([['a', { x: 0, y: 0 }], ['b', { x: 1, y: 0 }]]);
    const m = computeCoeffMatrix(cursors, baseParams);
    expect(m.get('a')!.get('b')!).toBeLessThan(0);
  });

  it('inverts sign when invert param is set', () => {
    const cursors = new Map([['a', { x: 0.5, y: 0.5 }]]);
    const m = computeCoeffMatrix(cursors, { ...baseParams, invert: true });
    expect(m.get('a')!.get('a')).toBeCloseTo(-baseParams.forceScale);
  });

  it('only contains entries for currently-present cursors', () => {
    const cursors = new Map([['b', { x: 0.5, y: 0.5 }]]);
    const m = computeCoeffMatrix(cursors, baseParams);
    expect(m.has('a')).toBe(false);
    expect(m.get('b')!.get('a')).toBeUndefined();
  });
});

describe('applyPairwiseForces', () => {
  it('pushes particles apart when inside the core radius', () => {
    const parts: Particle[] = [
      { x: 0, y: 0, vx: 0, vy: 0, ownerId: 'a' },
      { x: 5, y: 0, vx: 0, vy: 0, ownerId: 'a' },
    ];
    const coeffM = new Map([['a', new Map([['a', 100]])]]);
    applyPairwiseForces(parts, coeffM, baseParams, 1);
    expect(parts[0].vx).toBeLessThan(0); // pushed away from b (which is to the right)
    expect(parts[1].vx).toBeGreaterThan(0);
  });

  it('attracts particles toward each other outside the core when coeff is positive', () => {
    const parts: Particle[] = [
      { x: 0, y: 0, vx: 0, vy: 0, ownerId: 'a' },
      { x: 20, y: 0, vx: 0, vy: 0, ownerId: 'a' },
    ];
    const coeffM = new Map([['a', new Map([['a', 50]])]]);
    applyPairwiseForces(parts, coeffM, baseParams, 1);
    expect(parts[0].vx).toBeGreaterThan(0); // pulled toward b
  });

  it("skips a pair when their owners' coefficient is missing", () => {
    const parts: Particle[] = [
      { x: 0, y: 0, vx: 0, vy: 0, ownerId: 'a' },
      { x: 20, y: 0, vx: 0, vy: 0, ownerId: 'b' },
    ];
    const coeffM = new Map([
      ['a', new Map([['a', 100]])],
      ['b', new Map([['b', 100]])],
    ]);
    applyPairwiseForces(parts, coeffM, baseParams, 1);
    expect(parts[0].vx).toBe(0);
    expect(parts[1].vx).toBe(0);
  });
});

describe('integrateParticles', () => {
  it('moves a particle by velocity * dt', () => {
    const parts: Particle[] = [{ x: 50, y: 50, vx: 10, vy: 0, ownerId: 'a' }];
    integrateParticles(parts, baseParams, 1, 200, 200);
    expect(parts[0].x).toBeCloseTo(60);
  });

  it('clamps speed to maxSpeed', () => {
    const parts: Particle[] = [{ x: 50, y: 50, vx: 5000, vy: 0, ownerId: 'a' }];
    integrateParticles(parts, { ...baseParams, maxSpeed: 100 }, 1, 1000, 1000);
    expect(Math.hypot(parts[0].vx, parts[0].vy)).toBeCloseTo(100);
  });

  it('bounces off the left/top wall', () => {
    const parts: Particle[] = [{ x: 2, y: 2, vx: -50, vy: -50, ownerId: 'a' }];
    integrateParticles(parts, baseParams, 1, 200, 200);
    expect(parts[0].x).toBe(6);
    expect(parts[0].vx).toBeGreaterThan(0);
    expect(parts[0].y).toBe(6);
    expect(parts[0].vy).toBeGreaterThan(0);
  });

  it('bounces off the right/bottom wall', () => {
    const parts: Particle[] = [{ x: 198, y: 198, vx: 50, vy: 50, ownerId: 'a' }];
    integrateParticles(parts, baseParams, 1, 200, 200);
    expect(parts[0].x).toBe(194);
    expect(parts[0].vx).toBeLessThan(0);
    expect(parts[0].y).toBe(194);
    expect(parts[0].vy).toBeLessThan(0);
  });

  it('applies center gravity toward canvas center', () => {
    const parts: Particle[] = [{ x: 0, y: 100, vx: 0, vy: 0, ownerId: 'a' }];
    integrateParticles(parts, { ...baseParams, centerGravity: 1 }, 1, 200, 200);
    expect(parts[0].vx).toBeGreaterThan(0); // pulled toward cx=100
  });

  it('applies friction to damp velocity', () => {
    const parts: Particle[] = [{ x: 100, y: 100, vx: 100, vy: 0, ownerId: 'a' }];
    integrateParticles(parts, { ...baseParams, friction: 0.5 }, 0, 200, 200);
    expect(parts[0].vx).toBeCloseTo(50);
  });
});
