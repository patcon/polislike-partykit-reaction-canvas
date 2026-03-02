export type VoteRegion = 'agree' | 'disagree' | 'pass' | null;

// Vertices (normalized 0–100):
// AGREE:     top-right  (100, 0)
// DISAGREE:  bottom-left (0, 100)
// PASS:      bottom-right (100, 100)
export function computeVoteRegion(normalizedX: number, normalizedY: number): VoteRegion {
  const x = normalizedX / 100;
  const y = normalizedY / 100;

  const agree = { x: 1, y: 0 };
  const disagree = { x: 0, y: 1 };
  const pass = { x: 1, y: 1 };

  const denominator = (disagree.y - pass.y) * (agree.x - pass.x) + (pass.x - disagree.x) * (agree.y - pass.y);

  if (Math.abs(denominator) < 1e-10) {
    const dAgree = Math.hypot(x - agree.x, y - agree.y);
    const dDisagree = Math.hypot(x - disagree.x, y - disagree.y);
    const dPass = Math.hypot(x - pass.x, y - pass.y);
    const min = Math.min(dAgree, dDisagree, dPass);
    if (min === dAgree) return 'agree';
    if (min === dDisagree) return 'disagree';
    if (min === dPass) return 'pass';
    return null;
  }

  const wAgree = ((disagree.y - pass.y) * (x - pass.x) + (pass.x - disagree.x) * (y - pass.y)) / denominator;
  const wDisagree = ((pass.y - agree.y) * (x - pass.x) + (agree.x - pass.x) * (y - pass.y)) / denominator;
  const wPass = 1 - wAgree - wDisagree;

  const maxWeight = Math.max(wAgree, wDisagree, wPass);
  if (maxWeight === wAgree) return 'agree';
  if (maxWeight === wDisagree) return 'disagree';
  if (maxWeight === wPass) return 'pass';
  return null;
}
