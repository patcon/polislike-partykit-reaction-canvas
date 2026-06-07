import { describe, it, expect } from 'vitest';
import { makeImageCoordTransform } from '../../app/utils/imageCanvasCoords';

const SCREEN_LANDSCAPE = { width: 1200, height: 800 };
const SCREEN_PORTRAIT  = { width: 800,  height: 1200 };

// 4:3 image
const IMG_LANDSCAPE = { w: 800, h: 600 };
// 9:16 image
const IMG_PORTRAIT  = { w: 450, h: 800 };
// Exact match
const IMG_EXACT     = { w: 1200, h: 800 };

describe('makeImageCoordTransform — no image (linear fallback)', () => {
  it('maps 0,0 to top-left', () => {
    const t = makeImageCoordTransform(SCREEN_LANDSCAPE, null);
    expect(t(0, 0)).toEqual({ x: 0, y: 0 });
  });

  it('maps 100,100 to bottom-right', () => {
    const t = makeImageCoordTransform(SCREEN_LANDSCAPE, null);
    expect(t(100, 100)).toEqual({ x: 1200, y: 800 });
  });

  it('maps 50,50 to screen centre', () => {
    const t = makeImageCoordTransform(SCREEN_LANDSCAPE, null);
    expect(t(50, 50)).toEqual({ x: 600, y: 400 });
  });
});

describe('makeImageCoordTransform — image fills full screen (no letterbox)', () => {
  it('maps 0,0 to top-left', () => {
    const t = makeImageCoordTransform(SCREEN_LANDSCAPE, IMG_EXACT);
    expect(t(0, 0)).toEqual({ x: 0, y: 0 });
  });

  it('maps 100,100 to bottom-right', () => {
    const t = makeImageCoordTransform(SCREEN_LANDSCAPE, IMG_EXACT);
    expect(t(100, 100)).toEqual({ x: 1200, y: 800 });
  });

  it('maps 50,50 to screen centre', () => {
    const t = makeImageCoordTransform(SCREEN_LANDSCAPE, IMG_EXACT);
    expect(t(50, 50)).toEqual({ x: 600, y: 400 });
  });
});

describe('makeImageCoordTransform — landscape image on landscape screen (pillarbox)', () => {
  // 4:3 image on 3:2 screen → constrained by height, pillarboxed left/right
  // scale = min(1200/800, 800/600) = min(1.5, 1.333) = 1.333
  // dispW = 800 * 1.333 = 1066.67, dispH = 600 * 1.333 = 800
  // offX = (1200 - 1066.67) / 2 = 66.67, offY = 0
  const t = makeImageCoordTransform(SCREEN_LANDSCAPE, IMG_LANDSCAPE);

  it('maps 50,50 to screen centre', () => {
    const { x, y } = t(50, 50);
    expect(x).toBeCloseTo(600);
    expect(y).toBeCloseTo(400);
  });

  it('top-left of image is inset from screen left edge', () => {
    const { x, y } = t(0, 0);
    expect(x).toBeGreaterThan(0);  // pillarbox offset
    expect(y).toBeCloseTo(0);
  });

  it('bottom-right of image is inset from screen right edge', () => {
    const { x, y } = t(100, 100);
    expect(x).toBeLessThan(1200); // pillarbox offset
    expect(y).toBeCloseTo(800);
  });

  it('clamps cursor beyond left edge of image to x=0', () => {
    // A very negative virtual coord — clamped to 0
    const { x } = t(-50, 50);
    expect(x).toBe(0);
  });

  it('clamps cursor beyond right edge of image to screen width', () => {
    const { x } = t(200, 50);
    expect(x).toBe(1200);
  });
});

describe('makeImageCoordTransform — portrait image on landscape screen (letterbox)', () => {
  // 9:16 image on 3:2 screen → constrained by width, letterboxed top/bottom
  // scale = min(1200/450, 800/800) = min(2.667, 1) = 1
  // dispW = 450, dispH = 800
  // offX = (1200 - 450) / 2 = 375, offY = 0
  const t = makeImageCoordTransform(SCREEN_LANDSCAPE, IMG_PORTRAIT);

  it('maps 50,50 to screen centre', () => {
    const { x, y } = t(50, 50);
    expect(x).toBeCloseTo(600);
    expect(y).toBeCloseTo(400);
  });

  it('top-left of image is inset from screen left (pillarboxed)', () => {
    const { x } = t(0, 0);
    expect(x).toBeGreaterThan(0);
  });

  it('clamps cursor outside left margin to x=0', () => {
    expect(t(-100, 50).x).toBe(0);
  });

  it('clamps cursor outside right margin to screen width', () => {
    expect(t(200, 50).x).toBe(1200);
  });
});

describe('makeImageCoordTransform — portrait image on portrait screen', () => {
  // 9:16 image on portrait screen — scale = min(800/450, 1200/800) = min(1.778, 1.5) = 1.5
  // dispW = 450*1.5 = 675, dispH = 800*1.5 = 1200
  // offX = (800-675)/2 = 62.5, offY = 0
  const t = makeImageCoordTransform(SCREEN_PORTRAIT, IMG_PORTRAIT);

  it('maps 50,50 to screen centre', () => {
    const { x, y } = t(50, 50);
    expect(x).toBeCloseTo(400);
    expect(y).toBeCloseTo(600);
  });
});
