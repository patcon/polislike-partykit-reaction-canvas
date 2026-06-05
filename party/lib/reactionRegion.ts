export interface ReactionAnchors {
  positive: { x: number; y: number };
  negative: { x: number; y: number };
  neutral:  { x: number; y: number };
}

export const DEFAULT_ANCHORS: ReactionAnchors = {
  positive: { x: 95, y: 5  },
  negative: { x: 5,  y: 95 },
  neutral:  { x: 95, y: 95 },
};

export function computeReactionRegion(nx: number, ny: number, anchors: ReactionAnchors): 'positive' | 'negative' | 'neutral' {
  const x = nx / 100, y = ny / 100;
  const pos = { x: anchors.positive.x / 100, y: anchors.positive.y / 100 };
  const neg = { x: anchors.negative.x / 100, y: anchors.negative.y / 100 };
  const neu = { x: anchors.neutral.x  / 100, y: anchors.neutral.y  / 100 };
  const denom = (neg.y - neu.y) * (pos.x - neu.x) + (neu.x - neg.x) * (pos.y - neu.y);
  if (Math.abs(denom) < 1e-10) {
    const dp = Math.hypot(x - pos.x, y - pos.y);
    const dn = Math.hypot(x - neg.x, y - neg.y);
    const du = Math.hypot(x - neu.x, y - neu.y);
    const m = Math.min(dp, dn, du);
    return m === dp ? 'positive' : m === dn ? 'negative' : 'neutral';
  }
  const wPos = ((neg.y - neu.y) * (x - neu.x) + (neu.x - neg.x) * (y - neu.y)) / denom;
  const wNeg = ((neu.y - pos.y) * (x - neu.x) + (pos.x - neu.x) * (y - neu.y)) / denom;
  const wNeu = 1 - wPos - wNeg;
  const max = Math.max(wPos, wNeg, wNeu);
  return max === wPos ? 'positive' : max === wNeg ? 'negative' : 'neutral';
}
