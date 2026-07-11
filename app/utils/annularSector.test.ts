import { describe, it, expect } from "vitest";
import {
  makeGeometry,
  ellipsePoint,
  toBasis,
  regionFromPoint,
  type CellId,
  type Pt,
} from "./annularSector";

const HALF_PI = Math.PI / 2;
const apex: Pt = { x: 1000, y: 1000 };
const a = 800;
const b = 600;
const thresholdFrac = 0.5;
const innerFrac = 0.12;

const geo = makeGeometry(apex, a, b, 0, HALF_PI, thresholdFrac, innerFrac);

describe("makeGeometry", () => {
  it("stores the semi-axes and anchor thetas", () => {
    expect(geo.a).toBeCloseTo(a);
    expect(geo.b).toBeCloseTo(b);
    expect(geo.thetaDisagree).toBeCloseTo(0);
    expect(geo.thetaAgree).toBeCloseTo(HALF_PI);
    expect(geo.bisectorTheta).toBeCloseTo(HALF_PI / 2);
  });

  it("pins the pass anchor to the bisector at the threshold fraction", () => {
    const pass = ellipsePoint(geo, thresholdFrac, geo.bisectorTheta);
    const { alpha, beta } = toBasis(geo, pass);
    expect(Math.hypot(alpha, beta)).toBeCloseTo(thresholdFrac);
    expect(geo.thresholdFrac).toBeCloseTo(thresholdFrac);
  });

  it("puts the disagree handle on the bottom edge vertex", () => {
    const p = ellipsePoint(geo, 1, geo.thetaDisagree);
    expect(p.y).toBeCloseTo(apex.y);
  });

  it("puts the agree handle on the right edge vertex", () => {
    const p = ellipsePoint(geo, 1, geo.thetaAgree);
    expect(p.x).toBeCloseTo(apex.x);
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

describe("axis-aligned ellipse: free anchors", () => {
  it("meets both screen edges at 90° (radial edges are horizontal & vertical at the vertices)", () => {
    const atDisagree = ellipsePoint(geo, 1, 0);
    const atAgree = ellipsePoint(geo, 1, HALF_PI);
    expect(atDisagree.y).toBeCloseTo(apex.y); // bottom edge → horizontal radial
    expect(atAgree.x).toBeCloseTo(apex.x); // right edge → vertical radial
  });

  it("keeps a free anchor on the arc when reshaped", () => {
    // Drag DISAGREE: change a (horizontal) and slide theta (vertical). The
    // handle must still lie exactly on the outer arc for its theta.
    const a2 = 500;
    const thetaDisagree = 0.6;
    const g2 = makeGeometry(apex, a2, b, thetaDisagree, HALF_PI, thresholdFrac, innerFrac);
    const handle = ellipsePoint(g2, 1, g2.thetaDisagree);
    expect(Math.hypot(handle.x - (apex.x - a2 * Math.cos(thetaDisagree)), handle.y - (apex.y - b * Math.sin(thetaDisagree)))).toBeLessThan(1);
  });
});
