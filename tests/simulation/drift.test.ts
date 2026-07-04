import { describe, it, expect } from 'vitest';
import { createDriftProgram } from '../../app/lib/simulation/programs/drift';
import type { SimContext } from '../../app/lib/simulation/types';

const CTX: SimContext = { userCount: 5, seed: 42, regionAnchors: {} as SimContext['regionAnchors'] };

describe('drift program', () => {
  it('is deterministic for a fixed seed', () => {
    const a = createDriftProgram(); a.init(CTX);
    const b = createDriftProgram(); b.init(CTX);
    for (let i = 0; i < 50; i++) {
      expect(a.tick(i * 50, 50)).toEqual(b.tick(i * 50, 50));
    }
  });

  it('diverges for a different seed', () => {
    const a = createDriftProgram(); a.init(CTX);
    const b = createDriftProgram(); b.init({ ...CTX, seed: 7 });
    // Advance both a bit, then compare a late tick.
    let ea, eb;
    for (let i = 0; i < 30; i++) { ea = a.tick(i * 50, 50); eb = b.tick(i * 50, 50); }
    expect(ea).not.toEqual(eb);
  });

  it('emits one move per user keyed sim_<i>', () => {
    const p = createDriftProgram(); p.init(CTX);
    const ev = p.tick(50, 50);
    expect(ev).toHaveLength(5);
    expect(ev.map((e) => e.position.userId)).toEqual(['sim_0', 'sim_1', 'sim_2', 'sim_3', 'sim_4']);
    expect(ev.every((e) => e.type === 'move')).toBe(true);
  });

  it('keeps coordinates within 0..100 over a long run', () => {
    const p = createDriftProgram(); p.init(CTX);
    for (let i = 0; i < 300; i++) {
      for (const e of p.tick(i * 50, 50)) {
        expect(e.position.x).toBeGreaterThanOrEqual(0);
        expect(e.position.x).toBeLessThanOrEqual(100);
        expect(e.position.y).toBeGreaterThanOrEqual(0);
        expect(e.position.y).toBeLessThanOrEqual(100);
      }
    }
  });

  it('keeps moving (retargets on arrival, not frozen)', () => {
    const p = createDriftProgram(); p.init({ ...CTX, userCount: 1 });
    const xs = new Set<number>();
    for (let i = 0; i < 400; i++) xs.add(Math.round(p.tick(i * 50, 50)[0].position.x));
    expect(xs.size).toBeGreaterThan(5);
  });

  it('teardown emits a remove for every user', () => {
    const p = createDriftProgram(); p.init(CTX);
    const t = p.teardown();
    expect(t).toHaveLength(5);
    expect(t.every((e) => e.type === 'remove')).toBe(true);
    expect(t.map((e) => e.position.userId)).toEqual(['sim_0', 'sim_1', 'sim_2', 'sim_3', 'sim_4']);
  });
});
