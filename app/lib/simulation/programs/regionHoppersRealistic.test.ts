import { describe, it, expect } from 'vitest';
import {
  createRealisticRegionHoppersProgram,
  regionHotspots,
} from './regionHoppersRealistic';
import { DEFAULT_ANCHORS } from '../../../utils/voteRegion';
import type { SimContext } from '../types';

const CTX: SimContext = { userCount: 6, seed: 42, regionAnchors: DEFAULT_ANCHORS };
const HOTSPOTS = regionHotspots(DEFAULT_ANCHORS);

function nearestHotspot(x: number, y: number): number {
  return Math.min(...HOTSPOTS.map((h) => Math.hypot(h.x - x, h.y - y)));
}

describe('regionHotspots', () => {
  it('pulls the region anchors inward toward the canvas centre', () => {
    // positive anchor (95,5) pulled ~30% toward (50,50) => (81.5, 18.5)
    expect(HOTSPOTS[0].x).toBeGreaterThan(50);
    expect(HOTSPOTS[0].x).toBeLessThan(95);
    expect(HOTSPOTS[0].y).toBeGreaterThan(5);
    for (const h of HOTSPOTS) {
      expect(Math.abs(h.x - 50)).toBeLessThan(Math.max(...HOTSPOTS.map((k) => Math.abs(k.x - 50))) + 1);
    }
  });
});

describe('realistic region-hoppers program', () => {
  it('is deterministic for a fixed seed', () => {
    const a = createRealisticRegionHoppersProgram(); a.init(CTX);
    const b = createRealisticRegionHoppersProgram(); b.init(CTX);
    for (let i = 0; i < 120; i++) expect(a.tick(i * 50, 50)).toEqual(b.tick(i * 50, 50));
  });

  it('emits one move per user keyed sim_<i>, coords in 0..100', () => {
    const p = createRealisticRegionHoppersProgram(); p.init(CTX);
    for (let i = 0; i < 200; i++) {
      const ev = p.tick(i * 50, 50);
      expect(ev).toHaveLength(6);
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

  it('does not move every cursor in lockstep (timing/personality jitter)', () => {
    const p = createRealisticRegionHoppersProgram(); p.init(CTX);
    // Advance a bit, then snapshot: cursors should be at distinct positions.
    let ev = p.tick(0, 50);
    for (let i = 1; i < 40; i++) ev = p.tick(i * 50, 50);
    const keys = new Set(ev.map((e) => `${e.position.x.toFixed(1)},${e.position.y.toFixed(1)}`));
    expect(keys.size).toBeGreaterThan(1);
  });

  it('settles cursors near the region hotspots (targets regions, not arbitrary points)', () => {
    const p = createRealisticRegionHoppersProgram(); p.init({ ...CTX, userCount: 1 });
    let best = Infinity;
    for (let i = 0; i < 600; i++) {
      const e = p.tick(i * 50, 50)[0];
      best = Math.min(best, nearestHotspot(e.position.x, e.position.y));
    }
    expect(best).toBeLessThan(12); // reaches a hotspot's rest orbit
  });

  it('teardown emits a remove for every user', () => {
    const p = createRealisticRegionHoppersProgram(); p.init(CTX);
    const t = p.teardown();
    expect(t).toHaveLength(6);
    expect(t.every((e) => e.type === 'remove')).toBe(true);
  });
});
