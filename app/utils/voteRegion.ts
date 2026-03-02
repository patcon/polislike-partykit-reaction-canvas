export type ReactionRegion = 'positive' | 'negative' | 'neutral' | null;

// Vertices (normalized 0–100):
// POSITIVE:  top-right  (100, 0)
// NEGATIVE:  bottom-left (0, 100)
// NEUTRAL:   bottom-right (100, 100)
export function computeVoteRegion(normalizedX: number, normalizedY: number): ReactionRegion {
  const x = normalizedX / 100;
  const y = normalizedY / 100;

  const positive = { x: 1, y: 0 };
  const negative = { x: 0, y: 1 };
  const neutral  = { x: 1, y: 1 };

  const denominator = (negative.y - neutral.y) * (positive.x - neutral.x) + (neutral.x - negative.x) * (positive.y - neutral.y);

  if (Math.abs(denominator) < 1e-10) {
    const dPositive = Math.hypot(x - positive.x, y - positive.y);
    const dNegative = Math.hypot(x - negative.x, y - negative.y);
    const dNeutral  = Math.hypot(x - neutral.x,  y - neutral.y);
    const min = Math.min(dPositive, dNegative, dNeutral);
    if (min === dPositive) return 'positive';
    if (min === dNegative) return 'negative';
    if (min === dNeutral)  return 'neutral';
    return null;
  }

  const wPositive = ((negative.y - neutral.y) * (x - neutral.x) + (neutral.x - negative.x) * (y - neutral.y)) / denominator;
  const wNegative = ((neutral.y - positive.y) * (x - neutral.x) + (positive.x - neutral.x) * (y - neutral.y)) / denominator;
  const wNeutral  = 1 - wPositive - wNegative;

  const maxWeight = Math.max(wPositive, wNegative, wNeutral);
  if (maxWeight === wPositive) return 'positive';
  if (maxWeight === wNegative) return 'negative';
  if (maxWeight === wNeutral)  return 'neutral';
  return null;
}
