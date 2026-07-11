import { describe, it, expect } from "vitest";
import {
  makeGeometry,
  ellipsePoint,
  toBasis,
  regionFromPoint,
  type CellId,
  type Pt,
} from "./annularSector";

const apex: Pt = { x: 1000, y: 1000 };
const rOut = 800;
const disagree: Pt = { x: apex.x - rOut, y: apex.y }; // west edge
const agree: Pt = { x: apex.x, y: apex.y - rOut }; // north edge
const thresholdFrac = 0.5;
const innerFrac = 0.12;

const geo = makeGeometry(apex, disagree, agree, thresholdFrac, innerFrac);

describe("makeGeometry", () => {
  it("stores the anchor vectors from the apex", () => {
    expect(geo.u).toEqual({ x: -rOut, y: 0 });
    expect(geo.v).toEqual({ x: 0, y: -rOut });
    expect(geo.bisectorTheta).toBeCloseTo(Math.PI / 4);
  });

  it("pins the pass anchor to the bisector at the threshold fraction", () => {
    const pass = ellipsePoint(geo, thresholdFrac, geo.bisectorTheta);
    const { alpha, beta } = toBasis(geo, pass);
    expect(Math.hypot(alpha, beta)).toBeCloseTo(thresholdFrac);
    expect(geo.thresholdFrac).toBeCloseTo(thresholdFrac);
  });
});

function sampleAt(id: CellId): Pt {
  const theta = id === "agree" ? geo.bisectorTheta + Math.PI / 8 : geo.bisectorTheta - Math.PI / 8;
  const frac = id === "pass" ? 0.25 : 0.75;
  return ellipsePoint(geo, frac, theta);
}

describe("regionFromPoint", () => {
  it("maps the disagree side to disagree with negative valence", () => {
    const r = regionFromPoint(geo, sampleAt("disagree"));
    expect(r.region).toBe("disagree");
    expect(r.valence).toBeLessThan(0);
  });

  it("maps the agree side to agree with positive valence", () => {
    const r = regionFromPoint(geo, sampleAt("agree"));
    expect(r.region).toBe("agree");
    expect(r.valence).toBeGreaterThan(0);
  });

  it("maps the inner band to pass with sub-threshold certainty", () => {
    const r = regionFromPoint(geo, sampleAt("pass"));
    expect(r.region).toBe("pass");
    expect(r.certainty).toBeLessThan(thresholdFrac);
  });

  it("treats points outside the wedge as outside", () => {
    expect(regionFromPoint(geo, { x: apex.x + 100, y: apex.y }).region).toBe("outside");
  });
});

describe("ellipsoid: independent edges", () => {
  it("smoothly connects unequal anchor offsets via the ellipse", () => {
    const stretched = makeGeometry(
      apex,
      { x: apex.x - 1200, y: apex.y },
      { x: apex.x, y: apex.y - 400 },
      thresholdFrac,
    );
    // Outer boundary must pass through both anchors exactly.
    const atDisagree = ellipsePoint(stretched, 1, 0);
    const atAgree = ellipsePoint(stretched, 1, Math.PI / 2);
    expect(Math.hypot(atDisagree.x - (apex.x - 1200), atDisagree.y - apex.y)).toBeLessThan(1);
    expect(Math.hypot(atAgree.x - apex.x, atAgree.y - (apex.y - 400))).toBeLessThan(1);
    // Midpoint of the outer arc should bulge beyond the straight chord.
    const mid = ellipsePoint(stretched, 1, Math.PI / 4);
    const chordMid = { x: (atDisagree.x + atAgree.x) / 2, y: (atDisagree.y + atAgree.y) / 2 };
    const bulge = Math.hypot(mid.x - chordMid.x, mid.y - chordMid.y);
    expect(bulge).toBeGreaterThan(1);
  });
});
