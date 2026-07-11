// Anchor-driven, axis-aligned ellipsoid annular-sector geometry for the
// valence × certainty prototype.
//
// The outer boundary is a quarter ELLIPSE centred at the apex (the bottom-right
// corner) with its two axes horizontal + vertical. That axis-alignment is what
// makes the arc meet each radial edge at a right angle (at the ellipse's
// vertices). The inner (annular) boundary and the threshold (PASS vs AGREE /
// DISAGREE) are the same ellipse scaled by a fraction, so the whole sector is
// homothetic and still meets every edge at a right angle.
//
// DISAGREE / AGREE are points ON the outer arc (free to slide along it). They
// set the horizontal reach `a` and vertical reach `b` (reshaping the ellipse),
// and mark where valence = −1 / +1 sit. The arc extends past them to the
// vertices. A single PASS anchor rides the valence bisector (the Q3/Q4
// boundary) and sets the certainty threshold.

export interface Pt {
  x: number;
  y: number;
}

export type CellId = "disagree" | "agree" | "pass";

export type SectorRegion = "disagree" | "agree" | "pass" | "outside";

export interface SectorGeometry {
  apex: Pt;
  /** Horizontal semi-axis (DISAGREE reach). */
  a: number;
  /** Vertical semi-axis (AGREE reach). */
  b: number;
  /** Ellipse parameter where valence = −1 (DISAGREE handle). */
  thetaDisagree: number;
  /** Ellipse parameter where valence = +1 (AGREE handle). */
  thetaAgree: number;
  /** Ellipse parameter of the valence bisector (valence = 0). */
  bisectorTheta: number;
  /** PASS fraction of the outer ellipse (certainty threshold). */
  thresholdFrac: number;
  /** Inner (annular) fraction of the outer ellipse. */
  innerFrac: number;
}

export interface RegionReadout {
  region: SectorRegion;
  /** −1 (disagree) … +1 (agree), derived from angle within the wedge. */
  valence: number;
  /** 0 (inner) … 1 (outer), derived from the ellipse fraction. */
  certainty: number;
  inSector: boolean;
}

const HALF_PI = Math.PI / 2;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Point on the ellipse at fraction `frac` (0..1) and parameter θ (0..π/2). */
export function ellipsePoint(geo: SectorGeometry, frac: number, theta: number): Pt {
  return {
    x: geo.apex.x - frac * geo.a * Math.cos(theta),
    y: geo.apex.y - frac * geo.b * Math.sin(theta),
  };
}

export function makeGeometry(
  apex: Pt,
  a: number,
  b: number,
  thetaDisagree: number,
  thetaAgree: number,
  thresholdFrac: number,
  innerFrac = 0.12,
): SectorGeometry {
  return {
    apex,
    a: Math.max(1, a),
    b: Math.max(1, b),
    thetaDisagree: clamp(thetaDisagree, 0, HALF_PI),
    thetaAgree: clamp(thetaAgree, 0, HALF_PI),
    bisectorTheta: (clamp(thetaDisagree, 0, HALF_PI) + clamp(thetaAgree, 0, HALF_PI)) / 2,
    thresholdFrac: clamp(thresholdFrac, 0.05, 0.95),
    innerFrac,
  };
}

/** Solve p − apex = α·(−a,0) + β·(0,−b), returning the ellipse basis coords. */
export function toBasis(geo: SectorGeometry, p: Pt): { alpha: number; beta: number } {
  return {
    alpha: (geo.apex.x - p.x) / geo.a,
    beta: (geo.apex.y - p.y) / geo.b,
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
  const inSector = theta >= -1e-9 && theta <= HALF_PI + 1e-9 && frac <= 1 + 1e-9;
  if (!inSector) {
    return { region: "outside", valence: 0, certainty: 0, inSector: false };
  }
  const certainty = clamp((frac - geo.innerFrac) / (1 - geo.innerFrac), 0, 1);
  const span = Math.max(1e-6, geo.thetaAgree - geo.thetaDisagree);
  let valence: number;
  if (theta <= geo.thetaDisagree) valence = -1;
  else if (theta >= geo.thetaAgree) valence = 1;
  else valence = (2 * (theta - geo.thetaDisagree)) / span - 1;
  let region: SectorRegion = "pass";
  if (frac >= geo.thresholdFrac) region = valence < 0 ? "disagree" : "agree";
  return { region, valence, certainty, inSector: true };
}
