// Anchor-driven, ellipsoid annular-sector geometry for the valence × certainty
// prototype.
//
// Unlike a fixed circular sector, the sector shape is defined by three anchors:
//   • `disagree` — outer corner of the DISAGREE edge (one side of the wedge)
//   • `agree`    — outer corner of the AGREE edge (other side of the wedge)
//   • `pass`     — sits on the valence bisector (the Q3/Q4 boundary) and sets
//                 the certainty threshold (how far the PASS band reaches out)
//
// The wedge is the angular span between the disagree and agree rays that
// contains the pass anchor. The outer radius is interpolated between the two
// edge distances, so moving disagree/agree independently makes the boundary
// ellipsoid rather than circular. The inner boundary (annular hole) is a fixed
// fraction of the outer radius, and the threshold (PASS vs AGREE/DISAGREE) is a
// fixed fraction, so the whole sector scales homothetically with the anchors.

export interface Pt {
  x: number;
  y: number;
}

export type CellId = "disagree" | "agree" | "pass";

export type SectorRegion = "disagree" | "agree" | "pass" | "outside";

export interface SectorGeometry {
  apex: Pt;
  /** Starting angle of the wedge (disagree edge), radians. */
  phiStart: number;
  /** Ending angle of the wedge (agree edge), radians. */
  phiEnd: number;
  /** phiEnd − phiStart wrapped to (0, 2π]. */
  delta: number;
  /** Outer radius at the disagree edge. */
  rStart: number;
  /** Outer radius at the agree edge. */
  rEnd: number;
  /** Angle of the valence bisector (Q3/Q4 boundary), radians. */
  bisectorPhi: number;
  /** PASS fraction of the outer radius (certainty threshold). */
  thresholdFrac: number;
  /** Inner (annular) fraction of the outer radius. */
  innerFrac: number;
}

export interface RegionReadout {
  region: SectorRegion;
  /** −1 (disagree) … +1 (agree), derived from angle within the wedge. */
  valence: number;
  /** 0 (inner) … 1 (outer), derived from radius within the wedge. */
  certainty: number;
  inSector: boolean;
}

const TWO_PI = Math.PI * 2;

function norm2pi(a: number): number {
  return ((a % TWO_PI) + TWO_PI) % TWO_PI;
}

/** True if angle `a` lies on the CCW arc from aStart to aEnd (inclusive). */
function inArc(aStart: number, aEnd: number, a: number): boolean {
  const s = norm2pi(aStart);
  let e = norm2pi(aEnd);
  let x = norm2pi(a);
  if (e < s) e += TWO_PI;
  if (x < s) x += TWO_PI;
  return x <= e + 1e-9;
}

/** Outer radius at angle φ (linear interpolation between the two edge distances). */
export function outerRadiusAt(geo: SectorGeometry, phi: number): number {
  const t = norm2pi(phi - geo.phiStart) / geo.delta;
  return geo.rStart + (geo.rEnd - geo.rStart) * t;
}

export function pointAtRadius(geo: SectorGeometry, r: number, phi: number): Pt {
  return { x: geo.apex.x + r * Math.cos(phi), y: geo.apex.y + r * Math.sin(phi) };
}

export function makeGeometryFromAnchors(
  apex: Pt,
  disagree: Pt,
  agree: Pt,
  pass: Pt,
  innerFrac = 0.12,
): SectorGeometry {
  const ang = (p: Pt) => Math.atan2(p.y - apex.y, p.x - apex.x);
  const aD = ang(disagree);
  const aG = ang(agree);
  const aP = ang(pass);
  const rD = Math.hypot(disagree.x - apex.x, disagree.y - apex.y);
  const rG = Math.hypot(agree.x - apex.x, agree.y - apex.y);

  let phiStart: number, phiEnd: number, rStart: number, rEnd: number;
  if (inArc(aD, aG, aP)) {
    phiStart = aD;
    phiEnd = aG;
    rStart = rD;
    rEnd = rG;
  } else {
    // Pass falls in the other arc — swap so the wedge contains the pass anchor.
    phiStart = aG;
    phiEnd = aD;
    rStart = rG;
    rEnd = rD;
  }

  let delta = norm2pi(phiEnd - phiStart);
  if (delta < 1e-6) delta = Math.PI / 2;

  const bisectorPhi = phiStart + delta / 2;
  const rOutBis = (rStart + rEnd) / 2;
  const rPass = Math.hypot(pass.x - apex.x, pass.y - apex.y);
  const thresholdFrac = Math.max(0.05, Math.min(0.95, rPass / rOutBis));

  return { apex, phiStart, phiEnd, delta, rStart, rEnd, bisectorPhi, thresholdFrac, innerFrac };
}

/** Filled polygon for a sub-cell bounded by radius fractions [rInnerFrac, rOuterFrac] × [phi0, phi1]. */
export function cellPath(
  geo: SectorGeometry,
  rInnerFrac: number,
  rOuterFrac: number,
  phi0: number,
  phi1: number,
  steps = 48,
): string {
  const pts: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const phi = phi0 + (phi1 - phi0) * (i / steps);
    const r = rOuterFrac * outerRadiusAt(geo, phi);
    pts.push(pointAtRadius(geo, r, phi));
  }
  for (let i = steps; i >= 0; i--) {
    const phi = phi0 + (phi1 - phi0) * (i / steps);
    const r = rInnerFrac * outerRadiusAt(geo, phi);
    pts.push(pointAtRadius(geo, r, phi));
  }
  return "M " + pts.map((p) => `${p.x} ${p.y}`).join(" L ") + " Z";
}

/** Open polyline along a radius fraction (0..1 of outer) from φ0 to φ1. */
export function arcPath(
  geo: SectorGeometry,
  rFrac: number,
  phi0: number,
  phi1: number,
  steps = 48,
): string {
  const pts: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const phi = phi0 + (phi1 - phi0) * (i / steps);
    const r = rFrac * outerRadiusAt(geo, phi);
    pts.push(pointAtRadius(geo, r, phi));
  }
  return "M " + pts.map((p) => `${p.x} ${p.y}`).join(" L ");
}

/** Radial line (inner → outer boundary) at a fixed angle. */
export function radialPath(geo: SectorGeometry, phi: number): string {
  const rOut = outerRadiusAt(geo, phi);
  const inner = pointAtRadius(geo, geo.innerFrac * rOut, phi);
  const outer = pointAtRadius(geo, rOut, phi);
  return `M ${inner.x} ${inner.y} L ${outer.x} ${outer.y}`;
}

/** Map a panel point to its region, valence, and certainty. */
export function regionFromPoint(geo: SectorGeometry, p: Pt): RegionReadout {
  const vx = p.x - geo.apex.x;
  const vy = p.y - geo.apex.y;
  const r = Math.hypot(vx, vy);
  const ang = Math.atan2(vy, vx);
  const inWedge = inArc(geo.phiStart, geo.phiEnd, ang);
  const rOut = outerRadiusAt(geo, ang);
  const inSector = inWedge && r <= rOut + 1;
  if (!inSector) {
    return { region: "outside", valence: 0, certainty: 0, inSector: false };
  }
  const t = norm2pi(ang - geo.phiStart) / geo.delta;
  const rThr = geo.thresholdFrac * rOut;
  const rIn = geo.innerFrac * rOut;
  const certainty = Math.max(0, Math.min(1, (r - rIn) / (rOut - rIn)));
  const valence = 2 * t - 1;
  let region: SectorRegion = "pass";
  if (r >= rThr) region = t < 0.5 ? "disagree" : "agree";
  return { region, valence, certainty, inSector: true };
}
