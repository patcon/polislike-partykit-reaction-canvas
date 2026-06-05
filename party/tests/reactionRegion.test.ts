import { describe, it, expect } from 'vitest';
import { computeReactionRegion, DEFAULT_ANCHORS, type ReactionAnchors } from '../lib/reactionRegion';

describe('computeReactionRegion with default anchors', () => {
  it('classifies top-right corner as positive', () => {
    expect(computeReactionRegion(95, 5, DEFAULT_ANCHORS)).toBe('positive');
  });

  it('classifies bottom-left corner as negative', () => {
    expect(computeReactionRegion(5, 95, DEFAULT_ANCHORS)).toBe('negative');
  });

  it('classifies bottom-right corner as neutral', () => {
    expect(computeReactionRegion(95, 95, DEFAULT_ANCHORS)).toBe('neutral');
  });

  it('classifies mid-canvas sensibly', () => {
    const result = computeReactionRegion(50, 50, DEFAULT_ANCHORS);
    expect(['positive', 'negative', 'neutral']).toContain(result);
  });
});

describe('computeReactionRegion with custom anchors', () => {
  const CUSTOM: ReactionAnchors = {
    positive: { x: 5,  y: 5  },
    negative: { x: 95, y: 5  },
    neutral:  { x: 50, y: 95 },
  };

  it('classifies top-left as positive with custom anchors', () => {
    expect(computeReactionRegion(5, 5, CUSTOM)).toBe('positive');
  });

  it('classifies top-right as negative with custom anchors', () => {
    expect(computeReactionRegion(95, 5, CUSTOM)).toBe('negative');
  });

  it('classifies bottom-center as neutral with custom anchors', () => {
    expect(computeReactionRegion(50, 95, CUSTOM)).toBe('neutral');
  });
});
