import { SWIRL_STRENGTH } from './constants';
import type { Params, Particle } from './types';

/**
 * Coefficient matrix from cursor proximity — ported from
 * particle-valence-experiments/src/lib/particle-sim/physics.ts, adapted to be
 * keyed by userId (the live cursor set changes size/membership every frame,
 * so a dense NxN array indexed by position isn't stable) rather than a fixed
 * array index. `cursors` coordinates are expected normalized to 0..1 (same
 * space `proximityRange` was tuned against in the source repo).
 */
export function computeCoeffMatrix(
  cursors: Map<string, { x: number; y: number }>,
  P: Params,
): Map<string, Map<string, number>> {
  const ids = [...cursors.keys()];
  const coeffM = new Map<string, Map<string, number>>();
  for (const i of ids) {
    const row = new Map<string, number>();
    const ci = cursors.get(i)!;
    for (const j of ids) {
      const cj = cursors.get(j)!;
      const cursorDist = i === j ? 0 : Math.hypot(ci.x - cj.x, ci.y - cj.y);
      let closeness = 1 - cursorDist / Math.max(0.01, P.proximityRange);
      closeness = Math.max(-1, Math.min(1, closeness));
      row.set(j, P.forceScale * closeness * (P.invert ? -1 : 1));
    }
    coeffM.set(i, row);
  }
  return coeffM;
}

/** Pairwise forces between particles, coefficient from their owning cursors; mutates velocities. */
export function applyPairwiseForces(
  parts: Particle[],
  coeffM: Map<string, Map<string, number>>,
  P: Params,
  dt: number,
) {
  for (let i = 0; i < parts.length; i++) {
    for (let j = 0; j < parts.length; j++) {
      if (i === j) continue;
      const a = parts[i], b = parts[j];
      const coeff = coeffM.get(a.coeffKey ?? a.ownerId)?.get(b.coeffKey ?? b.ownerId);
      if (coeff == null) continue;

      const dx = b.x - a.x, dy = b.y - a.y;
      const r = Math.hypot(dx, dy) || 0.001;
      const ux = dx / r, uy = dy / r;

      let f: number;
      if (r < P.coreRadius) {
        // hard core repulsion regardless of coefficient
        f = -P.forceScale * 2 * (1 - r / P.coreRadius);
      } else if (coeff >= 0) {
        // attraction: peaks just outside the core, fades by `falloff`
        const t = (r - P.coreRadius) / Math.max(1, P.falloff - P.coreRadius);
        f = coeff * Math.max(0, 1 - t);
      } else {
        // repulsion: doesn't fall to zero with distance — far cursors
        // keep pushing their particles apart (1/r near-field + constant floor)
        const near = Math.min(1, (P.coreRadius * 3) / r);
        f = coeff * (0.25 + 0.75 * near);
      }
      a.vx += ux * f * dt;
      a.vy += uy * f * dt;

      // Swirl: add a tangential component (90° from the radial direction) so
      // particles curve around each other instead of approaching head-on.
      if (P.dynamism !== 'none') {
        const swirl = SWIRL_STRENGTH[P.dynamism];
        a.vx += -uy * f * swirl * dt;
        a.vy += ux * f * swirl * dt;
      }
    }
  }
}

/** Integrate, center gravity, damp, clamp, bounce; mutates particles in place. */
export function integrateParticles(parts: Particle[], P: Params, dt: number, w: number, h: number) {
  const cx = w / 2, cy = h / 2;
  for (const p of parts) {
    if (P.centerGravity > 0) {
      p.vx += (cx - p.x) * P.centerGravity * dt;
      p.vy += (cy - p.y) * P.centerGravity * dt;
    }
    p.vx *= 1 - P.friction;
    p.vy *= 1 - P.friction;
    const s = Math.hypot(p.vx, p.vy);
    if (s > P.maxSpeed) { p.vx *= P.maxSpeed / s; p.vy *= P.maxSpeed / s; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.x < 6) { p.x = 6; p.vx = Math.abs(p.vx); }
    if (p.x > w - 6) { p.x = w - 6; p.vx = -Math.abs(p.vx); }
    if (p.y < 6) { p.y = 6; p.vy = Math.abs(p.vy); }
    if (p.y > h - 6) { p.y = h - 6; p.vy = -Math.abs(p.vy); }
  }
}
