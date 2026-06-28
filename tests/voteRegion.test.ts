import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ANCHORS,
  computeReactionRegion,
  computeCursorValence,
  valenceToPosition,
  reactionLabelStyle,
  type ReactionAnchors,
} from '../app/utils/voteRegion';

// DEFAULT_ANCHORS (0–100 canvas space):
//   positive top-right    (95, 5)
//   negative bottom-left  (5, 95)
//   neutral  bottom-right  (95, 95)

describe('computeReactionRegion', () => {
  it('classifies a point at the positive anchor as positive', () => {
    expect(computeReactionRegion(95, 5)).toBe('positive');
  });

  it('classifies a point at the negative anchor as negative', () => {
    expect(computeReactionRegion(5, 95)).toBe('negative');
  });

  it('classifies a point at the neutral anchor as neutral', () => {
    expect(computeReactionRegion(95, 95)).toBe('neutral');
  });

  it('classifies the top-right corner near the positive anchor', () => {
    expect(computeReactionRegion(90, 10)).toBe('positive');
  });

  it('classifies the bottom-left corner near the negative anchor', () => {
    expect(computeReactionRegion(10, 90)).toBe('negative');
  });

  it('respects custom anchors (swapped positive/negative)', () => {
    const swapped: ReactionAnchors = {
      positive: { x: 5, y: 95 },
      negative: { x: 95, y: 5 },
      neutral: { x: 95, y: 95 },
    };
    expect(computeReactionRegion(5, 95, swapped)).toBe('positive');
    expect(computeReactionRegion(95, 5, swapped)).toBe('negative');
  });

  describe('degenerate (collinear) anchors → nearest-anchor fallback', () => {
    const collinear: ReactionAnchors = {
      positive: { x: 0, y: 0 },
      negative: { x: 50, y: 50 },
      neutral: { x: 100, y: 100 },
    };

    it('returns positive when nearest to the positive anchor', () => {
      expect(computeReactionRegion(5, 5, collinear)).toBe('positive');
    });

    it('returns neutral when nearest to the neutral anchor', () => {
      expect(computeReactionRegion(95, 95, collinear)).toBe('neutral');
    });

    it('returns negative when nearest to the negative anchor', () => {
      expect(computeReactionRegion(50, 50, collinear)).toBe('negative');
    });
  });
});

describe('computeCursorValence', () => {
  it('returns ~100 at the positive anchor', () => {
    expect(computeCursorValence(95, 5)).toBeCloseTo(100, 5);
  });

  it('returns ~0 at the negative anchor', () => {
    expect(computeCursorValence(5, 95)).toBeCloseTo(0, 5);
  });

  it('returns ~50 at the neutral anchor', () => {
    expect(computeCursorValence(95, 95)).toBeCloseTo(50, 5);
  });

  it('clamps to the 0–100 range', () => {
    for (let x = -50; x <= 150; x += 25) {
      for (let y = -50; y <= 150; y += 25) {
        const v = computeCursorValence(x, y);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });

  it('uses the inverse-distance fallback for degenerate anchors', () => {
    const collinear: ReactionAnchors = {
      positive: { x: 0, y: 0 },
      negative: { x: 50, y: 50 },
      neutral: { x: 100, y: 100 },
    };
    const v = computeCursorValence(0, 0, collinear);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(100);
  });
});

describe('valenceToPosition', () => {
  const centroid = {
    x: (DEFAULT_ANCHORS.negative.x + DEFAULT_ANCHORS.neutral.x + DEFAULT_ANCHORS.positive.x) / 3,
    y: (DEFAULT_ANCHORS.negative.y + DEFAULT_ANCHORS.neutral.y + DEFAULT_ANCHORS.positive.y) / 3,
  };

  it('maps valence -1 to the negative anchor', () => {
    expect(valenceToPosition(-1, DEFAULT_ANCHORS)).toEqual(DEFAULT_ANCHORS.negative);
  });

  it('maps valence 0 to the centroid', () => {
    expect(valenceToPosition(0, DEFAULT_ANCHORS)).toEqual(centroid);
  });

  it('maps valence 1 to the positive anchor', () => {
    const p = valenceToPosition(1, DEFAULT_ANCHORS);
    expect(p.x).toBeCloseTo(DEFAULT_ANCHORS.positive.x, 5);
    expect(p.y).toBeCloseTo(DEFAULT_ANCHORS.positive.y, 5);
  });

  it('clamps valence below -1 to the negative anchor', () => {
    expect(valenceToPosition(-5, DEFAULT_ANCHORS)).toEqual(DEFAULT_ANCHORS.negative);
  });

  it('clamps valence above 1 to the positive anchor', () => {
    const p = valenceToPosition(5, DEFAULT_ANCHORS);
    expect(p.x).toBeCloseTo(DEFAULT_ANCHORS.positive.x, 5);
    expect(p.y).toBeCloseTo(DEFAULT_ANCHORS.positive.y, 5);
  });
});

describe('reactionLabelStyle', () => {
  it('anchors a top-right label by translating up and left', () => {
    expect(reactionLabelStyle({ x: 95, y: 5 })).toEqual({
      position: 'absolute',
      left: '95%',
      top: '5%',
      transform: 'translate(-100%, 0%)',
    });
  });

  it('anchors a bottom-left label by translating down and right', () => {
    expect(reactionLabelStyle({ x: 5, y: 95 })).toEqual({
      position: 'absolute',
      left: '5%',
      top: '95%',
      transform: 'translate(0%, -100%)',
    });
  });

  it('centers a dead-center label on both axes', () => {
    expect(reactionLabelStyle({ x: 50, y: 50 }).transform).toBe('translate(-50%, -50%)');
  });
});
