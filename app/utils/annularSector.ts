// Geometry + region logic for the annular-sector valence × certainty prototype.
//
// The touch surface is a quarter annular sector with its apex pinned to the
// bottom-right corner of the panel. Angle φ runs 0 → π/2, where φ=0 points
// west (along the bottom edge) and φ=π/2 points north (along the right edge):
//
//        (top-right = AGREE)
//      ╱│
//     ╱ │   φ=π/2
//    ╱  │
//   ╱   ●───── φ=π/4 (valence divider)
//  ╱  ╱│
// ╱ ╱  │  φ=0
// ●───────────── (bottom-left = DISAGREE)
// apex (bottom-right corner)
//
// Radius r is certainty: the inner band (r < threshold) is PASS, the outer band
// splits into AGREE (φ > π/4) vs DISAGREE (φ < π/4). Both PASS cells live in the
// bottom-right corner next to the apex.

export interface Pt {
  x: number;
  y: number;
}

export interface SectorGeometry {
  W: number;
  H: number;
  /** Inner radius — the curved inner boundary (0 collapses to the apex point). */
  r0: number;
  /** Outer radius — the curved outer boundary. */
  r1: number;
  /** Certainty-threshold radius — the curved line dividing PASS from the rest. */
  rm: number;
  /** Certainty threshold in 0..1 (fraction of the radial span). */
  threshold: number;
}

export type CellId = "disagree" | "agree" | "pass1" | "pass2";

export type SectorRegion = "disagree" | "agree" | "pass" | "outside";

export interface RegionReadout {
  region: SectorRegion;
  /** −1 (disagree) … +1 (agree), derived from angle. */
  valence: number;
  /** 0 (apex) … 1 (outer edge), derived from radius. */
  certainty: number;
  inSector: boolean;
}

export const HALF_PI = Math.PI / 2;
export const PHI_MID = Math.PI / 4;

export interface GeometryOptions {
  /** Fraction of min(W,H) used for the outer radius. */
  outerFrac?: number;
  /** Fraction of the outer radius used for the inner radius. */
  innerFrac?: number;
  /** Certainty threshold in 0..1. */
  threshold?: number;
}

export function makeGeometry(W: number, H: number, opts: GeometryOptions = {}): SectorGeometry {
  const outerFrac = opts.outerFrac ?? 0.92;
  const innerFrac = opts.innerFrac ?? 0.14;
  const threshold = opts.threshold ?? 0.5;
  const r1 = Math.min(W, H) * outerFrac;
  const r0 = r1 * innerFrac;
  const rm = r0 + threshold * (r1 - r0);
  return { W, H, r0, r1, rm, threshold };
}

/** Point at radius r and angle φ (apex at bottom-right, y-down screen coords). */
export function pointAt(geo: SectorGeometry, r: number, phi: number): Pt {
  return { x: geo.W - r * Math.cos(phi), y: geo.H - r * Math.sin(phi) };
}

/** SVG path for one annular cell bounded by [rIn, rOut] × [phi0, phi1]. */
export function cellPath(geo: SectorGeometry, rIn: number, rOut: number, phi0: number, phi1: number): string {
  const a = pointAt(geo, rOut, phi0);
  const b = pointAt(geo, rOut, phi1);
  const c = pointAt(geo, rIn, phi1);
  const d = pointAt(geo, rIn, phi0);
  if (rIn <= 0.5) {
    return `M ${a.x} ${a.y} A ${rOut} ${rOut} 0 0 1 ${b.x} ${b.y} L ${c.x} ${c.y} L ${d.x} ${d.y} Z`;
  }
  return `M ${a.x} ${a.y} A ${rOut} ${rOut} 0 0 1 ${b.x} ${b.y} L ${c.x} ${c.y} A ${rIn} ${rIn} 0 0 0 ${d.x} ${d.y} Z`;
}

/** SVG arc path for radius r from φ0 to φ1. Empty string when r is degenerate. */
export function arcPath(geo: SectorGeometry, r: number, phi0: number, phi1: number): string {
  if (r <= 0.5) return "";
  const a = pointAt(geo, r, phi0);
  const b = pointAt(geo, r, phi1);
  const sweep = phi1 >= phi0 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${r} ${r} 0 0 ${sweep} ${b.x} ${b.y}`;
}

/** Default anchor positions — one centered in each of the four quadrants. */
export function defaultAnchors(geo: SectorGeometry): Record<CellId, Pt> {
  const midOuter = (geo.rm + geo.r1) / 2;
  const midInner = (geo.r0 + geo.rm) / 2;
  return {
    disagree: pointAt(geo, midOuter, Math.PI / 8),
    agree: pointAt(geo, midOuter, (3 * Math.PI) / 8),
    pass1: pointAt(geo, midInner, Math.PI / 8),
    pass2: pointAt(geo, midInner, (3 * Math.PI) / 8),
  };
}

/** Map a panel point to its region, valence, and certainty. */
export function regionFromPoint(geo: SectorGeometry, p: Pt): RegionReadout {
  const vx = p.x - geo.W;
  const vy = p.y - geo.H;
  const r = Math.hypot(vx, vy);
  const inSector = vx <= 1 && vy <= 1 && r >= 0 && r <= geo.r1 + 1;
  const certainty = Math.max(0, Math.min(1, (r - geo.r0) / (geo.r1 - geo.r0)));
  let phi = Math.atan2(-vy, -vx);
  if (phi < 0) phi = 0;
  if (phi > HALF_PI) phi = HALF_PI;
  const valence = (2 * phi) / HALF_PI - 1;
  let region: SectorRegion = "outside";
  if (inSector) {
    if (certainty < geo.threshold) region = "pass";
    else region = valence >= 0 ? "agree" : "disagree";
  }
  return { region, valence, certainty, inSector };
}
