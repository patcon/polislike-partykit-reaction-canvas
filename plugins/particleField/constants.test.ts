import { describe, expect, it } from 'vitest';
import { hueForUser } from './constants';

describe('hueForUser', () => {
  it('is deterministic for the same id', () => {
    expect(hueForUser('user-abc')).toBe(hueForUser('user-abc'));
  });

  it('returns a hue in [0, 360)', () => {
    for (const id of ['a', 'user-abc', 'sim_wander_0', '']) {
      const hue = hueForUser(id);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    }
  });

  it('spreads ids sharing a long common prefix across the hue wheel', () => {
    // sim_wander_0..sim_wander_9 differ only by a trailing digit — a naive
    // char-sum hash puts them within ~1 degree of each other.
    const hues = Array.from({ length: 10 }, (_, i) => hueForUser(`sim_wander_${i}`));
    expect(new Set(hues).size).toBeGreaterThanOrEqual(9); // near-certainly all distinct
    const maxAdjacentDelta = Math.max(
      ...hues.slice(1).map((h, i) => Math.min(Math.abs(h - hues[i]), 360 - Math.abs(h - hues[i]))),
    );
    expect(maxAdjacentDelta).toBeGreaterThan(30);
  });
});
