import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ANCHORS,
  computeReactionRegion,
  computeCursorValence,
  valenceToPosition,
  valenceToPercent,
  reactionLabelStyle,
  valenceChordEndpoints,
  sampleValencePosition,
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
  it('returns +1 at the positive anchor', () => {
    expect(computeCursorValence(95, 5)).toBeCloseTo(1, 5);
  });

  it('returns -1 at the negative anchor', () => {
    expect(computeCursorValence(5, 95)).toBeCloseTo(-1, 5);
  });

  it('returns 0 at the neutral anchor', () => {
    expect(computeCursorValence(95, 95)).toBeCloseTo(0, 5);
  });

  it('clamps to the -1..1 range', () => {
    for (let x = -50; x <= 150; x += 25) {
      for (let y = -50; y <= 150; y += 25) {
        const v = computeCursorValence(x, y);
        expect(v).toBeGreaterThanOrEqual(-1);
        expect(v).toBeLessThanOrEqual(1);
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
    expect(v).toBeGreaterThanOrEqual(-1);
    expect(v).toBeLessThanOrEqual(1);
  });

  it('round-trips with valenceToPosition at the anchors', () => {
    // valenceToPosition(±1) lands on the pos/neg anchors; computeCursorValence
    // of those anchors must return ±1 — the two functions are now inverses.
    const pos = valenceToPosition(1, DEFAULT_ANCHORS);
    const neg = valenceToPosition(-1, DEFAULT_ANCHORS);
    expect(computeCursorValence(pos.x, pos.y)).toBeCloseTo(1, 5);
    expect(computeCursorValence(neg.x, neg.y)).toBeCloseTo(-1, 5);
  });

  // The continuous valence (weighted centroid) and the unit region (barycentric
  // argmax) disagree near boundaries — this is why unit mode must NOT be derived
  // by quantizing the continuous value. Point (59, 54.5) has barycentric weights
  // ≈ {pos: 0.45, neg: 0.40, neu: 0.15}: continuous ≈ +0.05 (nearly neutral) but
  // the argmax region is 'positive'.
  it('diverges from computeReactionRegion near a boundary', () => {
    expect(computeCursorValence(59, 54.5)).toBeCloseTo(0.05, 2);
    expect(computeReactionRegion(59, 54.5)).toBe('positive');
  });
});

describe('valenceToPercent', () => {
  it('maps -1 to 0%', () => {
    expect(valenceToPercent(-1)).toBeCloseTo(0, 5);
  });
  it('maps 0 to 50%', () => {
    expect(valenceToPercent(0)).toBeCloseTo(50, 5);
  });
  it('maps +1 to 100%', () => {
    expect(valenceToPercent(1)).toBeCloseTo(100, 5);
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

describe('sampleValencePosition', () => {
  const valences = [-1, -0.6, -0.3, 0, 0.3, 0.6, 1];
  const ts = [0, 0.25, 0.5, 0.75, 1];

  it('round-trips through computeCursorValence for every valence/t combination', () => {
    for (const v of valences) {
      for (const t of ts) {
        const p = sampleValencePosition(v, t, DEFAULT_ANCHORS);
        expect(computeCursorValence(p.x, p.y, DEFAULT_ANCHORS)).toBeCloseTo(v, 4);
      }
    }
  });

  it('collapses to a single point regardless of t when valence is ±1', () => {
    for (const v of [-1, 1]) {
      const points = ts.map((t) => sampleValencePosition(v, t, DEFAULT_ANCHORS));
      for (const p of points) {
        expect(p.x).toBeCloseTo(points[0].x, 5);
        expect(p.y).toBeCloseTo(points[0].y, 5);
      }
    }
  });

  it('stays within the DEFAULT_ANCHORS triangle (barycentric weights in [0,1])', () => {
    const pos = { x: DEFAULT_ANCHORS.positive.x / 100, y: DEFAULT_ANCHORS.positive.y / 100 };
    const neg = { x: DEFAULT_ANCHORS.negative.x / 100, y: DEFAULT_ANCHORS.negative.y / 100 };
    const neu = { x: DEFAULT_ANCHORS.neutral.x / 100, y: DEFAULT_ANCHORS.neutral.y / 100 };
    const denom = (neg.y - neu.y) * (pos.x - neu.x) + (neu.x - neg.x) * (pos.y - neu.y);

    for (const v of valences) {
      for (const t of ts) {
        const p = sampleValencePosition(v, t, DEFAULT_ANCHORS);
        const x = p.x / 100;
        const y = p.y / 100;
        const wPos = ((neg.y - neu.y) * (x - neu.x) + (neu.x - neg.x) * (y - neu.y)) / denom;
        const wNeg = ((neu.y - pos.y) * (x - neu.x) + (pos.x - neu.x) * (y - neu.y)) / denom;
        const wNeu = 1 - wPos - wNeg;
        for (const w of [wPos, wNeg, wNeu]) {
          expect(w).toBeGreaterThanOrEqual(-1e-9);
          expect(w).toBeLessThanOrEqual(1 + 1e-9);
        }
      }
    }
  });
});

describe('valenceChordEndpoints', () => {
  it('produces endpoints that both round-trip to the requested valence', () => {
    for (const v of [-1, -0.5, 0, 0.5, 1]) {
      const { a, b } = valenceChordEndpoints(v, DEFAULT_ANCHORS);
      expect(computeCursorValence(a.x, a.y, DEFAULT_ANCHORS)).toBeCloseTo(v, 4);
      expect(computeCursorValence(b.x, b.y, DEFAULT_ANCHORS)).toBeCloseTo(v, 4);
    }
  });

  it('the v=0 chord spans from the neutral anchor to the negative-positive midpoint', () => {
    const { a, b } = valenceChordEndpoints(0, DEFAULT_ANCHORS);
    // a(0) = lerp(neutral, positive, 0) = neutral; b(0) = lerp(negative, positive, 0.5) = midpoint
    expect(a).toEqual(DEFAULT_ANCHORS.neutral);
    expect(b.x).toBeCloseTo(50, 5);
    expect(b.y).toBeCloseTo(50, 5);
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
