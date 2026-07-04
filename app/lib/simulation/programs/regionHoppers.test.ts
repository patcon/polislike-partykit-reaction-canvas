import { describe, it, expect } from 'vitest';
import { createRegionHoppersProgram, pickRegionTarget } from './regionHoppers';
import { makePrng } from './_easing';
import { DEFAULT_ANCHORS } from '../../../utils/voteRegion';
import type { SimContext } from '../types';

const CTX: SimContext = { userCount: 5, seed: 42, regionAnchors: DEFAULT_ANCHORS };
const ANCHORS = [DEFAULT_ANCHORS.positive, DEFAULT_ANCHORS.negative, DEFAULT_ANCHORS.neutral];

function nearestAnchorDist(x: number, y: number): number {
  return Math.min(...ANCHORS.map((a) => Math.hypot(a.x - x, a.y - y)));
}

describe('pickRegionTarget', () => {
  it('always lands within jitter of one of the three region anchors', () => {
    const rnd = makePrng(1);
    const jitter = 6;
    for (let i = 0; i < 200; i++) {
      const t = pickRegionTarget(ANCHORS, rnd, jitter);
      // Within jitter on each axis => within jitter*sqrt(2) of the chosen anchor.
      expect(nearestAnchorDist(t.x, t.y)).toBeLessThanOrEqual(jitter * Math.SQRT2 + 1e-9);
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.x).toBeLessThanOrEqual(100);
      expect(t.y).toBeGreaterThanOrEqual(0);
      expect(t.y).toBeLessThanOrEqual(100);
    }
  });
});

describe('region-hoppers program', () => {
  it('is deterministic for a fixed seed', () => {
    const a = createRegionHoppersProgram(); a.init(CTX);
    const b = createRegionHoppersProgram(); b.init(CTX);
    for (let i = 0; i < 60; i++) expect(a.tick(i * 50, 50)).toEqual(b.tick(i * 50, 50));
  });

  it('emits one move per user keyed sim_<i>, coords in 0..100', () => {
    const p = createRegionHoppersProgram(); p.init(CTX);
    for (let i = 0; i < 200; i++) {
      const ev = p.tick(i * 50, 50);
      expect(ev).toHaveLength(5);
      for (const e of ev) {
        expect(e.type).toBe('move');
        expect(e.position.userId).toMatch(/^sim_\d+$/);
        expect(e.position.x).toBeGreaterThanOrEqual(0);
        expect(e.position.x).toBeLessThanOrEqual(100);
        expect(e.position.y).toBeGreaterThanOrEqual(0);
        expect(e.position.y).toBeLessThanOrEqual(100);
      }
    }
  });

  it('keeps users near the region anchors (not roaming the whole canvas)', () => {
    const p = createRegionHoppersProgram(); p.init({ ...CTX, userCount: 1 });
    // Track the closest a user ever gets to an anchor over a long run — it should
    // reach one (proving it targets regions, not arbitrary points).
    let best = Infinity;
    for (let i = 0; i < 400; i++) {
      const e = p.tick(i * 50, 50)[0];
      best = Math.min(best, nearestAnchorDist(e.position.x, e.position.y));
    }
    expect(best).toBeLessThan(10);
  });

  it('teardown emits a remove for every user', () => {
    const p = createRegionHoppersProgram(); p.init(CTX);
    const t = p.teardown();
    expect(t).toHaveLength(5);
    expect(t.every((e) => e.type === 'remove')).toBe(true);
  });
});
