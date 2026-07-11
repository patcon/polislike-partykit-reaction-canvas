import { describe, it, expect } from "vitest";
import {
  makeGeometryFromAnchors,
  outerRadiusAt,
  pointAtRadius,
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

const geo = makeGeometryFromAnchors(apex, disagree, agree, pointAtRadius(
  makeGeometryFromAnchors(apex, disagree, agree, apex, innerFrac),
  thresholdFrac * outerRadiusAt(makeGeometryFromAnchors(apex, disagree, agree, apex, innerFrac), Math.PI + Math.PI / 4),
  Math.PI + Math.PI / 4,
), innerFrac);

describe("makeGeometryFromAnchors", () => {
  it("uses the two edge distances as the outer radii", () => {
    expect(geo.rStart).toBeCloseTo(rOut);
    expect(geo.rEnd).toBeCloseTo(rOut);
    expect(geo.delta).toBeCloseTo(Math.PI / 2);
  });

  it("pins the pass anchor to the bisector at the threshold fraction", () => {
    const rOutBis = outerRadiusAt(geo, geo.bisectorPhi);
    expect(geo.thresholdFrac).toBeCloseTo(thresholdFrac);
    expect(geo.bisectorPhi).toBeCloseTo(Math.PI + Math.PI / 4);
    expect(rOutBis).toBeCloseTo(rOut);
  });
});

function sampleAt(id: CellId): Pt {
  const mid = id === "agree" ? geo.bisectorPhi + geo.delta / 4 : geo.bisectorPhi - geo.delta / 4;
  const r = outerRadiusAt(geo, mid) * (id === "pass" ? 0.25 : 0.75);
  return pointAtRadius(geo, r, mid);
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
  it("makes the outer radius follow the disagree/agree distances independently", () => {
    const stretched = makeGeometryFromAnchors(
      apex,
      { x: apex.x - 1200, y: apex.y },
      { x: apex.x, y: apex.y - 400 },
      { x: apex.x - 200, y: apex.y - 200 },
    );
    expect(stretched.rStart).toBeCloseTo(1200);
    expect(stretched.rEnd).toBeCloseTo(400);
    expect(outerRadiusAt(stretched, stretched.bisectorPhi)).toBeCloseTo(800);
  });
});
