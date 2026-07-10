import { describe, it, expect } from "vitest";
import {
  makeGeometry,
  pointAt,
  regionFromPoint,
  type CellId,
} from "./annularSector";

const geo = makeGeometry(1000, 1000, { outerFrac: 0.92, innerFrac: 0.14, threshold: 0.5 });

describe("makeGeometry", () => {
  it("derives radii from the panel size and threshold", () => {
    expect(geo.r1).toBeCloseTo(920);
    expect(geo.r0).toBeCloseTo(128.8);
    // rm sits at the threshold fraction of the radial span
    expect(geo.rm).toBeCloseTo(geo.r0 + 0.5 * (geo.r1 - geo.r0));
  });
});

describe("pointAt", () => {
  it("pins the apex at the bottom-right corner for r=0", () => {
    expect(pointAt(geo, 0, 0)).toEqual({ x: 1000, y: 1000 });
  });

  it("places φ=0 along the bottom edge (west) and φ=π/2 up the right edge (north)", () => {
    expect(pointAt(geo, geo.r0, 0).x).toBeCloseTo(1000 - geo.r0);
    expect(pointAt(geo, geo.r0, 0).y).toBeCloseTo(1000);
    expect(pointAt(geo, geo.r0, Math.PI / 2).x).toBeCloseTo(1000);
    expect(pointAt(geo, geo.r0, Math.PI / 2).y).toBeCloseTo(1000 - geo.r0);
  });
});

function anchorOf(id: CellId) {
  // Recompute the default anchor for a cell using the same formula as the component.
  const mid = id.startsWith("pass") ? (geo.r0 + geo.rm) / 2 : (geo.rm + geo.r1) / 2;
  const phi = id === "agree" || id === "pass2" ? (3 * Math.PI) / 8 : Math.PI / 8;
  return pointAt(geo, mid, phi);
}

describe("regionFromPoint", () => {
  it("maps the disagree cell to disagree with negative valence", () => {
    const r = regionFromPoint(geo, anchorOf("disagree"));
    expect(r.region).toBe("disagree");
    expect(r.valence).toBeLessThan(0);
  });

  it("maps the agree cell to agree with positive valence", () => {
    const r = regionFromPoint(geo, anchorOf("agree"));
    expect(r.region).toBe("agree");
    expect(r.valence).toBeGreaterThan(0);
  });

  it("maps both pass cells to pass with sub-threshold certainty", () => {
    for (const id of ["pass1", "pass2"] as CellId[]) {
      const r = regionFromPoint(geo, anchorOf(id));
      expect(r.region).toBe("pass");
      expect(r.certainty).toBeLessThan(geo.threshold);
    }
  });

  it("treats points outside the wedge or beyond the outer radius as outside", () => {
    expect(regionFromPoint(geo, { x: 1100, y: 1000 }).region).toBe("outside"); // east of apex
    expect(regionFromPoint(geo, { x: 0, y: 0 }).region).toBe("outside"); // top-left, beyond r1
  });
});
