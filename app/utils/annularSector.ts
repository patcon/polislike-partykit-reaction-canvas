// Anchor-driven, ellipsoid annular-sector geometry for the valence × certainty
// prototype.
//
// The sector shape is defined by three anchors:
//   • `disagree` — one outer corner of the sector (a vector `u` from the apex)
//   • `agree`    — the other outer corner (a vector `v` from the apex)
//   • `pass`     — sits on the valence bisector (the Q3/Q4 boundary) and sets
//                 the certainty threshold (how far the PASS band reaches out)
//
// The outer boundary is a smooth ELLIPSE through the two anchors, parameterised
// by their offset from the apex:  E(θ) = apex + frac · (u·cosθ + v·sinθ).
// θ runs 0 → π/2, with the disagree anchor at θ=0 and the agree anchor at θ=π/2,
// so the boundary smoothly connects them with no jarring edge. The inner
// (annular) boundary and the threshold (PASS vs AGREE/DISAGREE) are the same
// ellipse scaled by a fraction, so the whole sector is homothetic.

export interface Pt {
  x: number;
  y: number;
}

export type CellId = "disagree" | "agree" | "pass";

export type SectorRegion = "disagree" | "agree" | "pass" | "outside";

export interface SectorGeometry {
  apex: Pt;
  /** apex → disagree anchor (one conjugate radius of the ellipse). */
  u: Pt;
  /** apex → agree anchor (other conjugate radius of the ellipse). */
  v: Pt;
  /** Angle (θ-space) of the valence bisector — always π/4. */
  bisectorTheta: number;
  /** PASS fraction of the outer ellipse (certainty threshold). */
  thresholdFrac: number;
  /** Inner (annular) fraction of the outer ellipse. */
  innerFrac: number;
}

export interface RegionReadout {
  region: SectorRegion;
  /** −1 (disagree) … +1 (agree), derived from θ within the wedge. */
  valence: number;
  /** 0 (inner) … 1 (outer), derived from the ellipse fraction. */
  certainty: number;
  inSector: boolean;
}

const HALF_PI = Math.PI / 2;

/** Point on the ellipse at fraction `frac` (0..1) and angle θ (0..π/2). */
export function ellipsePoint(geo: SectorGeometry, frac: number, theta: number): Pt {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return {
    x: geo.apex.x + frac * (geo.u.x * c + geo.v.x * s),
    y: geo.apex.y + frac * (geo.u.y * c + geo.v.y * s),
  };
}

/**
 * Solve p − apex = α·u + β·v, returning the (α, β) coordinates in the
 * anchor basis. For points on the ellipse, (α, β) = (frac·cosθ, frac·sinθ),
 * so frac = hypot(α, β) and θ = atan2(β, α).
 */
export function toBasis(geo: SectorGeometry, p: Pt): { alpha: number; beta: number } {
  const dx = p.x - geo.apex.x;
  const dy = p.y - geo.apex.y;
  const det = geo.u.x * geo.v.y - geo.v.x * geo.u.y;
  if (Math.abs(det) < 1e-6) {
    // Degenerate (u ‖ v): fall back to projecting onto u.
    const lu = Math.hypot(geo.u.x, geo.u.y) || 1;
    const proj = (dx * geo.u.x + dy * geo.u.y) / (lu * lu);
    return { alpha: proj, beta: proj };
  }
  return {
    alpha: (dx * geo.v.y - dy * geo.v.x) / det,
    beta: (geo.u.x * dy - dx * geo.u.y) / det,
  };
}

export function makeGeometry(
  apex: Pt,
  disagree: Pt,
  agree: Pt,
  thresholdFrac: number,
  innerFrac = 0.12,
): SectorGeometry {
  return {
    apex,
    u: { x: disagree.x - apex.x, y: disagree.y - apex.y },
    v: { x: agree.x - apex.x, y: agree.y - apex.y },
    bisectorTheta: HALF_PI / 2,
    thresholdFrac: Math.max(0.05, Math.min(0.95, thresholdFrac)),
    innerFrac,
  };
}

/** Filled polygon for a sub-cell bounded by fraction [rInnerFrac, rOuterFrac] × [theta0, theta1]. */
export function cellPath(
  geo: SectorGeometry,
  rInnerFrac: number,
  rOuterFrac: number,
  theta0: number,
  theta1: number,
  steps = 48,
): string {
  const pts: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const theta = theta0 + (theta1 - theta0) * (i / steps);
    pts.push(ellipsePoint(geo, rOuterFrac, theta));
  }
  for (let i = steps; i >= 0; i--) {
    const theta = theta0 + (theta1 - theta0) * (i / steps);
    pts.push(ellipsePoint(geo, rInnerFrac, theta));
  }
  return "M " + pts.map((p) => `${p.x} ${p.y}`).join(" L ") + " Z";
}

/** Open polyline along a fraction (0..1 of outer) from θ0 to θ1. */
export function arcPath(
  geo: SectorGeometry,
  frac: number,
  theta0: number,
  theta1: number,
  steps = 48,
): string {
  const pts: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const theta = theta0 + (theta1 - theta0) * (i / steps);
    pts.push(ellipsePoint(geo, frac, theta));
  }
  return "M " + pts.map((p) => `${p.x} ${p.y}`).join(" L ");
}

/** Radial line (inner → outer boundary) at a fixed θ. */
export function radialPath(geo: SectorGeometry, theta: number): string {
  const inner = ellipsePoint(geo, geo.innerFrac, theta);
  const outer = ellipsePoint(geo, 1, theta);
  return `M ${inner.x} ${inner.y} L ${outer.x} ${outer.y}`;
}

/** Map a panel point to its region, valence, and certainty. */
export function regionFromPoint(geo: SectorGeometry, p: Pt): RegionReadout {
  const { alpha, beta } = toBasis(geo, p);
  const frac = Math.hypot(alpha, beta);
  const theta = Math.atan2(beta, alpha);
  const inWedge = theta >= -1e-9 && theta <= HALF_PI + 1e-9;
  const inSector = inWedge && frac <= 1 + 1e-9;
  if (!inSector) {
    return { region: "outside", valence: 0, certainty: 0, inSector: false };
  }
  const certainty = Math.max(0, Math.min(1, (frac - geo.innerFrac) / (1 - geo.innerFrac)));
  const valence = (2 * theta) / HALF_PI - 1;
  let region: SectorRegion = "pass";
  if (frac >= geo.thresholdFrac) region = theta < geo.bisectorTheta ? "disagree" : "agree";
  return { region, valence, certainty, inSector: true };
}
