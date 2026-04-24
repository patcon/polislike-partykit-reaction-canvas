import * as THREE from 'three';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import type { VizConfig, VizCameraState } from '../../types';

export const DEFAULT_VIZ_CONFIG: VizConfig = {
  viewMode: '2d',
  geometry: 'diametric',
  animation: 'sequential',
  traces: 'correlated',
  order: 'random',
  groups: 3,
  chords: 50,
  showGuides: false,
  cursorStyle: 'valence',
  radialStyle: 'valence',
  traceStyle: 'valence',
  fillStyle: 'valence',
  stylePastLikeCursor: false,
  cursorOpacity: 1.0,
  radialOpacity: 1.0,
  colorPositive: '#50ff8c',
  colorNegative: '#ff503c',
  colorNeutral: '#0f0f0e',
  eventFrequency: 8,
  driftSpeed: 0.02,
  exitAnimation: 'origin',
  chordPersistence: 'persistent',
  radialWidth: 2.0,
  cursorSize: 20,
  useGeometry: true,
};

export interface VisualizerScene {
  applyConfig(config: VizConfig): void;
  applyCamera(state: VizCameraState): void;
  dispose(): void;
}

export interface VisualizerSceneOptions {
  onCameraChange?: (state: VizCameraState) => void;
}

// ── Constants ──────────────────────────────────────────────
const MAX_N = 100;
const MAX_LIVE = 10;
const LIVE_BLUE = [66, 133, 244];
const TRACE_LEN = 300;
const TRACE_SEGS = TRACE_LEN - 1;
const TRACE_Z_STEP = 6;
const FIBS = [1, 2, 3, 5, 8, 13, 21];
const GROUP_RGB: [number, number, number][] = [
  [255, 160, 40], [255, 80, 160], [200, 80, 255],
  [50, 240, 180], [255, 230, 50], [120, 255, 60], [80, 160, 255],
];

type Chord = {
  mode: 'correlated' | 'random';
  value: number;
  target?: number;
  baseIdx?: number;
  noiseOffset?: number;
  arrivalT: number;
  departT?: number;
  departI?: number;
  departN?: number;
  departEffI?: number;
  departEffN?: number;
  history: [number, number, number, number, number][];
};

type LiveChord = {
  userId: string;
  value: number;
  arrivalT: number;
  departT?: number;
  hasTouched: boolean;
  lifted: boolean;
  history: [number, number, number, number, number][];
};

function hexToRgb(h: string): { r: number; g: number; b: number } {
  return {
    r: parseInt(h.slice(1, 3), 16),
    g: parseInt(h.slice(3, 5), 16),
    b: parseInt(h.slice(5, 7), 16),
  };
}

export function createVisualizerScene(
  container: HTMLDivElement,
  opts: VisualizerSceneOptions = {}
): VisualizerScene {
  // ── Mutable config state ────────────────────────────────
  let numChords = DEFAULT_VIZ_CONFIG.chords;
  let numGroups = DEFAULT_VIZ_CONFIG.groups;
  let showGuides = DEFAULT_VIZ_CONFIG.showGuides;
  let geoMode = DEFAULT_VIZ_CONFIG.geometry;
  let animMode = DEFAULT_VIZ_CONFIG.animation;
  let traceMode = DEFAULT_VIZ_CONFIG.traces;
  let orderMode = DEFAULT_VIZ_CONFIG.order;
  let exitAnim = DEFAULT_VIZ_CONFIG.exitAnimation;
  let entryMode = DEFAULT_VIZ_CONFIG.chordPersistence;
  let lineW = DEFAULT_VIZ_CONFIG.radialWidth;
  let dotBase = DEFAULT_VIZ_CONFIG.cursorSize;
  let eventFrequency = DEFAULT_VIZ_CONFIG.eventFrequency;
  let driftSpeed = DEFAULT_VIZ_CONFIG.driftSpeed;
  let useGeo = DEFAULT_VIZ_CONFIG.useGeometry;
  let stylePastLikeCursor = DEFAULT_VIZ_CONFIG.stylePastLikeCursor;
  let styles = { radial: DEFAULT_VIZ_CONFIG.radialStyle, cursor: DEFAULT_VIZ_CONFIG.cursorStyle, trace: DEFAULT_VIZ_CONFIG.traceStyle, fill: DEFAULT_VIZ_CONFIG.fillStyle };
  let opacities = { radial: DEFAULT_VIZ_CONFIG.radialOpacity, cursor: DEFAULT_VIZ_CONFIG.cursorOpacity, trace: 0.8, fill: 0.45 };
  let colors = {
    pos: { ...hexToRgb(DEFAULT_VIZ_CONFIG.colorPositive), a: 1 },
    neg: { ...hexToRgb(DEFAULT_VIZ_CONFIG.colorNegative), a: 1 },
    neutral: { ...hexToRgb(DEFAULT_VIZ_CONFIG.colorNeutral), a: 1 },
  };

  // ── Three.js setup ──────────────────────────────────────
  const W = container.clientWidth || 480;
  const H = container.clientHeight || 480;
  const R = 180, R_MID = 90;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(53.13, W / H, 0.1, 10000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x0f0f0e, 1);
  renderer.setSize(W, H);
  container.appendChild(renderer.domElement);

  // ── Scene objects ───────────────────────────────────────
  function makeRingLine(radius: number, z: number, color: number, opacity: number): THREE.Line {
    const N = 128;
    const arr = new Float32Array((N + 1) * 3);
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      arr[i * 3] = Math.cos(a) * radius;
      arr[i * 3 + 1] = Math.sin(a) * radius;
      arr[i * 3 + 2] = z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    return new THREE.Line(geo, mat);
  }

  const outerRing = makeRingLine(R, 0, 0x383835, 0.8);
  scene.add(outerRing);
  const midRing = makeRingLine(R_MID, 0, 0x2a2a28, 0);
  scene.add(midRing);

  const ghostRings = [-120, -240, -360].map(z => {
    const r = makeRingLine(R, z, 0x1e1e1c, 0);
    scene.add(r);
    return r;
  });

  let zAxisMat: THREE.LineBasicMaterial;
  {
    const arr = new Float32Array([0, 0, 0, 0, 0, -420]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    zAxisMat = new THREE.LineBasicMaterial({ color: 0x404040, transparent: true, opacity: 0 });
    scene.add(new THREE.Line(geo, zAxisMat));
  }

  {
    const N = 48, arr = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      arr[i * 3] = Math.cos(a) * R;
      arr[i * 3 + 1] = Math.sin(a) * R;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x3a3935, size: 3, sizeAttenuation: true })));
  }

  // Chord lines
  const chordPosArr = new Float32Array(MAX_N * 2 * 3);
  const chordColArr = new Float32Array(MAX_N * 2 * 3);
  const chordGeo = new LineSegmentsGeometry();
  chordGeo.setPositions(chordPosArr);
  chordGeo.setColors(chordColArr);
  const chordMat = new LineMaterial({ vertexColors: true, transparent: true, depthWrite: false, linewidth: lineW, resolution: new THREE.Vector2(W, H) });
  const chordLines = new LineSegments2(chordGeo, chordMat);
  chordLines.renderOrder = 7;
  scene.add(chordLines);
  const chordGeoBasic = new THREE.BufferGeometry();
  chordGeoBasic.setAttribute('position', new THREE.BufferAttribute(chordPosArr, 3));
  chordGeoBasic.setAttribute('color', new THREE.BufferAttribute(chordColArr, 3));
  const chordMatBasic = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false });
  const chordLinesBasic = new THREE.LineSegments(chordGeoBasic, chordMatBasic);
  chordLinesBasic.renderOrder = 7;
  chordLinesBasic.visible = false;
  scene.add(chordLinesBasic);

  // Cursor dots
  const dotPosArr = new Float32Array(MAX_N * 3);
  const dotColArr = new Float32Array(MAX_N * 3);
  const dotGeo = new THREE.BufferGeometry();
  dotGeo.setAttribute('position', new THREE.BufferAttribute(dotPosArr, 3));
  dotGeo.setAttribute('color', new THREE.BufferAttribute(dotColArr, 3));
  const dotMat = new THREE.PointsMaterial({ vertexColors: true, size: 6, sizeAttenuation: true, transparent: true, depthWrite: false });
  const dotPoints = new THREE.Points(dotGeo, dotMat);
  dotPoints.renderOrder = 10;
  scene.add(dotPoints);

  // Trace lines
  const tracePosArr = new Float32Array(MAX_N * TRACE_SEGS * 2 * 3);
  const traceColArr = new Float32Array(MAX_N * TRACE_SEGS * 2 * 3);
  const traceGeo = new THREE.BufferGeometry();
  traceGeo.setAttribute('position', new THREE.BufferAttribute(tracePosArr, 3));
  traceGeo.setAttribute('color', new THREE.BufferAttribute(traceColArr, 3));
  const traceMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false });
  const traceLines = new THREE.LineSegments(traceGeo, traceMat);
  traceLines.renderOrder = 5;
  scene.add(traceLines);

  // Fill surfaces
  const FILL_VERTS_PER_SEG = 6;
  const fillPosArr = new Float32Array(MAX_N * TRACE_SEGS * FILL_VERTS_PER_SEG * 3);
  const fillColArr = new Float32Array(MAX_N * TRACE_SEGS * FILL_VERTS_PER_SEG * 3);
  const fillGeo = new THREE.BufferGeometry();
  fillGeo.setAttribute('position', new THREE.BufferAttribute(fillPosArr, 3));
  fillGeo.setAttribute('color', new THREE.BufferAttribute(fillColArr, 3));
  const fillMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const fillMesh = new THREE.Mesh(fillGeo, fillMat);
  fillMesh.renderOrder = 4;
  scene.add(fillMesh);

  // Guide lines
  const guidePosArr = new Float32Array(MAX_N * 2 * 3);
  const guideColArr = new Float32Array(MAX_N * 2 * 3);
  const guideGeo = new THREE.BufferGeometry();
  guideGeo.setAttribute('position', new THREE.BufferAttribute(guidePosArr, 3));
  guideGeo.setAttribute('color', new THREE.BufferAttribute(guideColArr, 3));
  const guideMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, depthTest: false });
  const guideLines = new THREE.LineSegments(guideGeo, guideMat);
  guideLines.renderOrder = -1;
  scene.add(guideLines);

  // Live user geometry
  const liveCPosArr = new Float32Array(MAX_LIVE * 2 * 3);
  const liveCColArr = new Float32Array(MAX_LIVE * 2 * 3);
  const liveCGeo = new LineSegmentsGeometry();
  liveCGeo.setPositions(liveCPosArr);
  liveCGeo.setColors(liveCColArr);
  const liveCMat = new LineMaterial({ vertexColors: true, transparent: true, depthWrite: false, linewidth: lineW, resolution: new THREE.Vector2(W, H) });
  const liveCLines = new LineSegments2(liveCGeo, liveCMat);
  liveCLines.renderOrder = 7;
  scene.add(liveCLines);

  const liveDPosArr = new Float32Array(MAX_LIVE * 3);
  const liveDColArr = new Float32Array(MAX_LIVE * 3);
  const liveDGeo = new THREE.BufferGeometry();
  liveDGeo.setAttribute('position', new THREE.BufferAttribute(liveDPosArr, 3));
  liveDGeo.setAttribute('color', new THREE.BufferAttribute(liveDColArr, 3));
  const liveDMat = new THREE.PointsMaterial({ vertexColors: true, size: 6, sizeAttenuation: true, transparent: true, depthWrite: false });
  const liveDPoints = new THREE.Points(liveDGeo, liveDMat);
  liveDPoints.renderOrder = 10;
  scene.add(liveDPoints);

  const liveTrPosArr = new Float32Array(MAX_LIVE * TRACE_SEGS * 2 * 3);
  const liveTrColArr = new Float32Array(MAX_LIVE * TRACE_SEGS * 2 * 3);
  const liveTrGeo = new THREE.BufferGeometry();
  liveTrGeo.setAttribute('position', new THREE.BufferAttribute(liveTrPosArr, 3));
  liveTrGeo.setAttribute('color', new THREE.BufferAttribute(liveTrColArr, 3));
  const liveTrMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false });
  const liveTrLines = new THREE.LineSegments(liveTrGeo, liveTrMat);
  liveTrLines.renderOrder = 5;
  scene.add(liveTrLines);

  const liveFiPosArr = new Float32Array(MAX_LIVE * TRACE_SEGS * FILL_VERTS_PER_SEG * 3);
  const liveFiColArr = new Float32Array(MAX_LIVE * TRACE_SEGS * FILL_VERTS_PER_SEG * 3);
  const liveFiGeo = new THREE.BufferGeometry();
  liveFiGeo.setAttribute('position', new THREE.BufferAttribute(liveFiPosArr, 3));
  liveFiGeo.setAttribute('color', new THREE.BufferAttribute(liveFiColArr, 3));
  const liveFiMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const liveFiMesh = new THREE.Mesh(liveFiGeo, liveFiMat);
  liveFiMesh.renderOrder = 4;
  scene.add(liveFiMesh);

  // ── Camera / view state ─────────────────────────────────
  let camRadius = 480, camTheta = 0, camPhi = 0;
  let orbitDTheta = 0, orbitDPhi = 0, orbitDRadius = 0;
  const CAM_2D = { radius: 480, theta: 0, phi: 0 };
  const CAM_2D_TS = { radius: 480, theta: Math.PI / 2, phi: 0 };
  const CAM_3D = { radius: 560, theta: Math.PI / 5, phi: Math.PI / 9 };
  let viewMode: VizConfig['viewMode'] = '2d';
  let transT = 0, transTts = 0;
  const TRANS_SPEED = 0.04;

  function ease(t: number) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
  function clamp01(t: number) { return Math.min(1, Math.max(0, t)); }

  function applyCam() {
    const theta = camTheta + orbitDTheta;
    const phi = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, camPhi + orbitDPhi));
    const effR = camRadius + orbitDRadius;
    camera.position.set(
      effR * Math.sin(theta) * Math.cos(phi),
      effR * Math.sin(phi),
      effR * Math.cos(theta) * Math.cos(phi)
    );
    camera.lookAt(0, 0, 0);
    camera.up.set(0, 1, 0);
  }

  function lerpCam(et: number) {
    camRadius = CAM_2D.radius + (CAM_3D.radius - CAM_2D.radius) * et;
    camTheta = CAM_2D.theta + (CAM_3D.theta - CAM_2D.theta) * et;
    camPhi = CAM_2D.phi + (CAM_3D.phi - CAM_2D.phi) * et;
  }

  // ── Orbit controls ──────────────────────────────────────
  let isDragging = false, dragLast = { x: 0, y: 0 }, dtBase = 0, dpBase = 0;
  let lastTouchDist = 0, touchBase = { dt: 0, dp: 0 }, touchStart = { x: 0, y: 0 };

  function emitCamera() {
    if (opts.onCameraChange) {
      opts.onCameraChange({ viewMode, theta: camTheta + orbitDTheta, phi: camPhi + orbitDPhi, radius: camRadius + orbitDRadius });
    }
  }

  renderer.domElement.addEventListener('mousedown', (e: MouseEvent) => {
    if (viewMode !== '3d' || transT < 0.7) return;
    isDragging = true;
    dragLast = { x: e.clientX, y: e.clientY };
    dtBase = orbitDTheta;
    dpBase = orbitDPhi;
    e.preventDefault();
  });
  const onMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    orbitDTheta = dtBase - (e.clientX - dragLast.x) * 0.009;
    orbitDPhi = dpBase + (e.clientY - dragLast.y) * 0.009;
    applyCam();
  };
  const onMouseUp = () => {
    if (isDragging) { isDragging = false; emitCamera(); }
  };
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);

  renderer.domElement.addEventListener('wheel', (e: WheelEvent) => {
    if (viewMode !== '3d') return;
    orbitDRadius = Math.max(250 - camRadius, Math.min(1400 - camRadius, orbitDRadius + e.deltaY * 0.6));
    applyCam();
    emitCamera();
    e.preventDefault();
  }, { passive: false });

  renderer.domElement.addEventListener('touchstart', (e: TouchEvent) => {
    if (e.touches.length === 1) {
      isDragging = viewMode === '3d';
      touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      touchBase = { dt: orbitDTheta, dp: orbitDPhi };
    } else if (e.touches.length === 2) {
      isDragging = false;
      lastTouchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }
    e.preventDefault();
  }, { passive: false });

  renderer.domElement.addEventListener('touchmove', (e: TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      orbitDTheta = touchBase.dt - (e.touches[0].clientX - touchStart.x) * 0.009;
      orbitDPhi = touchBase.dp + (e.touches[0].clientY - touchStart.y) * 0.009;
      applyCam();
    } else if (e.touches.length === 2) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const scale = lastTouchDist / d;
      const newEff = Math.max(250, Math.min(1400, (camRadius + orbitDRadius) * scale));
      orbitDRadius = newEff - camRadius;
      lastTouchDist = d;
      applyCam();
    }
    e.preventDefault();
  }, { passive: false });

  renderer.domElement.addEventListener('touchend', () => {
    if (isDragging) { isDragging = false; emitCamera(); }
  });

  // ── Valence state ───────────────────────────────────────
  let paused = false;
  let morphT = 0, groupTargets: number[] = [0, 0, 0], eventTimer = 0;
  let inParallelTransition = false, inParallelRadialTransition = false;
  let chords: Chord[] = [];
  let departingChords: Chord[] = [];
  let liveChords: LiveChord[] = [];

  // ── Color helpers ───────────────────────────────────────
  function valenceRGB(v: number): [number, number, number] {
    const t = Math.pow(Math.abs(v), 0.55);
    const { r: nr, g: ng, b: nb } = colors.neutral;
    const src = v >= 0 ? colors.pos : colors.neg;
    return [Math.round(nr + (src.r - nr) * t), Math.round(ng + (src.g - ng) * t), Math.round(nb + (src.b - nb) * t)];
  }
  function elementRGBA(chord: Chord, v: number, mode: string, op: number): [number, number, number, number] {
    if (mode === 'group' && chord.mode === 'correlated' && chord.baseIdx !== undefined) {
      const [r, g, b] = GROUP_RGB[chord.baseIdx % GROUP_RGB.length];
      return [r, g, b, op];
    }
    const [r, g, b] = valenceRGB(v);
    const t = Math.pow(Math.abs(v), 0.55);
    const srcA = v >= 0 ? colors.pos.a : colors.neg.a;
    const a = (colors.neutral.a + (srcA - colors.neutral.a) * t) * op;
    return [r, g, b, Math.min(1, Math.max(0, a))];
  }
  function neutralRGBA(op: number): [number, number, number, number] {
    const { r, g, b, a } = colors.neutral;
    return [r, g, b, a * op];
  }
  function liveElementRGBA(v: number, mode: string, op: number): [number, number, number, number] {
    if (mode === 'group') return [LIVE_BLUE[0], LIVE_BLUE[1], LIVE_BLUE[2], op];
    const [r, g, b] = valenceRGB(v);
    const t = Math.pow(Math.abs(v), 0.55);
    const srcA = v >= 0 ? colors.pos.a : colors.neg.a;
    const a = (colors.neutral.a + (srcA - colors.neutral.a) * t) * op;
    return [r, g, b, Math.min(1, Math.max(0, a))];
  }

  // ── Geometry helpers ────────────────────────────────────
  function getPhases(mt: number, toRadial: boolean) {
    if (animMode === 'simultaneous') { const e = ease(mt); return { p1: e, p2: e }; }
    if (toRadial) return { p1: ease(clamp01(mt * 2)), p2: ease(clamp01((mt - 0.5) * 2)) };
    const rev = 1 - mt;
    return { p2: 1 - ease(clamp01(rev * 2)), p1: 1 - ease(clamp01((rev - 0.5) * 2)) };
  }
  function getChordPoints(i: number, n: number, v: number, p1: number, p2: number, pp1: number, pp2: number, lp1: number, lp2: number) {
    const tilt = (Math.PI / n) * 0.5, absV = Math.abs(v);
    const dAx = (i / n) * Math.PI + tilt;
    const dTA = v >= 0 ? dAx + Math.PI : dAx;
    const dTX = 240 + Math.cos(dTA) * R * absV, dTY = 240 + Math.sin(dTA) * R * absV;
    const rSA = (i / n) * 2 * Math.PI + tilt - Math.PI / 2;
    let sd = rSA - dAx; while (sd > Math.PI) sd -= 2 * Math.PI; while (sd < -Math.PI) sd += 2 * Math.PI;
    const sa = dAx + sd * p2, sc = Math.cos(sa), ss = Math.sin(sa);
    const rRX = 240 + sc * R_MID, rRY = 240 + ss * R_MID, rTR = R_MID * (1 - v);
    let rootX = 240 + (rRX - 240) * p1, rootY = 240 + (rRY - 240) * p1;
    let tipX = dTX + (240 + sc * rTR - dTX) * p1, tipY = dTY + (240 + ss * rTR - dTY) * p1;
    if (pp1 > 0 || pp2 > 0) {
      const pX = n > 1 ? 240 + (i - (n - 1) / 2) / (n - 1) * 2 * R : 240;
      rootX += (pX - rootX) * pp1; rootY += (240 - rootY) * pp1;
      tipX += (pX - tipX) * pp2; tipY += (240 - R * v - tipY) * pp2;
    }
    if (lp1 > 0 || lp2 > 0) {
      rootX += (240 - rootX) * lp1; rootY += (240 - rootY) * lp1;
      tipX += (240 - tipX) * lp2; tipY += (240 - R * v - tipY) * lp2;
    }
    return { rootX, rootY, tipX, tipY };
  }
  function getGuidePoints(i: number, n: number, p1: number, p2: number, pp1: number, pp2: number, lp1: number, lp2: number) {
    const tilt = (Math.PI / n) * 0.5, da = (i / n) * Math.PI + tilt;
    const dNx = 240 + Math.cos(da) * R, dNy = 240 + Math.sin(da) * R;
    const dPx = 240 + Math.cos(da + Math.PI) * R, dPy = 240 + Math.sin(da + Math.PI) * R;
    const rsa = (i / n) * 2 * Math.PI + tilt - Math.PI / 2;
    let sd = rsa - da; while (sd > Math.PI) sd -= 2 * Math.PI; while (sd < -Math.PI) sd += 2 * Math.PI;
    const sa = da + sd * p2, sc = Math.cos(sa), ss = Math.sin(sa);
    let posX = dPx + (240 - dPx) * p1, posY = dPy + (240 - dPy) * p1;
    let negX = dNx + (240 + sc * R - dNx) * p1, negY = dNy + (240 + ss * R - dNy) * p1;
    if (pp2 > 0) {
      const pX = n > 1 ? 240 + (i - (n - 1) / 2) / (n - 1) * 2 * R : 240;
      posX += (pX - posX) * pp2; posY += (240 - R - posY) * pp2;
      negX += (pX - negX) * pp2; negY += (240 + R - negY) * pp2;
    }
    if (lp2 > 0) { posX += (240 - posX) * lp2; posY += (240 - R - posY) * lp2; negX += (240 - negX) * lp2; negY += (240 + R - negY) * lp2; }
    return { posX, posY, negX, negY };
  }
  function cv(x: number, y: number): [number, number, number] { return [x - 240, 240 - y, 0]; }

  // ── Chord logic ─────────────────────────────────────────
  function randomVal() { return Math.random() * 2 - 1; }
  function fireGroupEvent() { const ng = numGroups; groupTargets = Array.from({ length: ng }, () => randomVal()); }
  function fireEvent() {
    if (traceMode === 'correlated') fireGroupEvent();
    else chords.forEach(c => { c.target = randomVal(); });
  }

  function assignBase(pos: number, ng: number) {
    const w = FIBS.slice(0, ng), tot = w.reduce((a, b) => a + b, 0);
    let cum = 0;
    for (let g = 0; g < ng; g++) { cum += w[g] / tot; if (pos < cum) return g; }
    return ng - 1;
  }
  function makeChord(i: number, n: number, ng: number): Chord {
    if (traceMode === 'random') return { mode: 'random', value: randomVal() * 0.4, target: randomVal(), history: [], arrivalT: 0 };
    return { mode: 'correlated', baseIdx: assignBase((i + 0.5) / n, ng), value: (Math.random() - 0.5) * 0.3, noiseOffset: (Math.random() - 0.5) * 0.12, history: [], arrivalT: 0 };
  }
  function initChords() {
    const n = numChords, ng = numGroups; chords = [];
    if (traceMode === 'random') { for (let i = 0; i < n; i++) chords.push(makeChord(i, n, ng)); return; }
    const asgn = Array.from({ length: n }, (_, i) => assignBase((i + 0.5) / n, ng));
    if (orderMode === 'random') {
      for (let i = asgn.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [asgn[i], asgn[j]] = [asgn[j], asgn[i]]; }
    }
    for (let i = 0; i < n; i++) chords.push({ mode: 'correlated', baseIdx: asgn[i], value: (Math.random() - 0.5) * 0.3, noiseOffset: (Math.random() - 0.5) * 0.12, history: [], arrivalT: 0 });
    while (groupTargets.length < ng) groupTargets.push(randomVal());
    groupTargets.length = ng;
    fireGroupEvent();
  }
  function idealGroupCounts(n: number, ng: number) {
    const counts = new Array(ng).fill(0);
    for (let i = 0; i < n; i++) counts[assignBase((i + 0.5) / n, ng)]++;
    return counts;
  }
  function currentGroupCounts(ng: number) {
    const counts = new Array(ng).fill(0);
    chords.forEach(c => { if (c.baseIdx != null) counts[c.baseIdx]++; });
    return counts;
  }
  function updateChordCount() {
    const n = numChords, ng = numGroups;
    if (traceMode === 'correlated' && (orderMode === 'random' || entryMode === 'persistent')) {
      while (chords.length < n) {
        const ideal = idealGroupCounts(n, ng), cur = currentGroupCounts(ng);
        let maxDef = -Infinity, tg = 0;
        for (let g = 0; g < ng; g++) { const d = ideal[g] - cur[g]; if (d > maxDef) { maxDef = d; tg = g; } }
        const c = makeChord(chords.length, n, ng); c.baseIdx = tg;
        if (exitAnim === 'none' || exitAnim === 'origin') c.value = Math.max(-1, Math.min(1, (groupTargets[tg] || 0) + (c.noiseOffset || 0)));
        if (orderMode === 'grouped') {
          let insertAt = chords.length;
          for (let k = chords.length - 1; k >= 0; k--) { if (chords[k].baseIdx === tg) { insertAt = k + 1; break; } }
          chords.splice(insertAt, 0, c);
        } else { chords.push(c); }
      }
      while (chords.length > n) {
        const ideal = idealGroupCounts(n, ng), cur = currentGroupCounts(ng);
        let maxSur = -Infinity, tg = 0;
        for (let g = 0; g < ng; g++) { const s = cur[g] - ideal[g]; if (s > maxSur) { maxSur = s; tg = g; } }
        let idx = chords.length - 1;
        for (let i = chords.length - 1; i >= 0; i--) { if (chords[i].baseIdx === tg) { idx = i; break; } }
        if (exitAnim === 'origin') {
          let departEffI = idx, departEffN = chords.length;
          if (entryMode === 'persistent' && orderMode === 'grouped') {
            const g = chords[idx].baseIdx!;
            let localCount = 0, localIdx = 0;
            for (let k = 0; k < chords.length; k++) { if (chords[k].baseIdx === g) { if (k === idx) localIdx = localCount; localCount++; } }
            if (localCount > 0) {
              const ng2 = numGroups, fw = FIBS.slice(0, ng2), ftot = fw.reduce((a, b) => a + b, 0);
              let cumW = 0; for (let gg = 0; gg < g; gg++) cumW += fw[gg];
              departEffI = cumW * localCount + localIdx * fw[g]; departEffN = ftot * localCount;
            }
          }
          const [dc] = chords.splice(idx, 1);
          dc.departI = idx; dc.departN = chords.length + 1; dc.departEffI = departEffI; dc.departEffN = departEffN;
          departingChords.push(dc);
        } else { chords.splice(idx, 1); }
      }
    } else {
      const prevLen = chords.length;
      if (n > chords.length) {
        for (let i = chords.length; i < n; i++) chords.push(makeChord(i, n, ng));
      } else if (n < chords.length) {
        while (chords.length > n) {
          if (exitAnim === 'origin') { const [dc] = chords.splice(chords.length - 1, 1); dc.departI = chords.length; dc.departN = chords.length + 1; departingChords.push(dc); }
          else { chords.splice(chords.length - 1, 1); }
        }
      }
      if (traceMode === 'correlated') {
        for (let i = 0; i < chords.length; i++) chords[i].baseIdx = assignBase((i + 0.5) / n, ng);
        if (exitAnim === 'none' || exitAnim === 'origin') {
          for (let i = prevLen; i < chords.length; i++) chords[i].value = Math.max(-1, Math.min(1, (groupTargets[chords[i].baseIdx!] || 0) + (chords[i].noiseOffset || 0)));
        }
      }
    }
  }
  initChords();

  // ── Resize handling ─────────────────────────────────────
  const resizeObserver = new ResizeObserver(() => {
    const w = container.clientWidth, h = container.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    chordMat.resolution.set(w, h);
    liveCMat.resolution.set(w, h);
  });
  resizeObserver.observe(container);

  // ── Main animate loop ───────────────────────────────────
  let animFrameId: number;
  function animate() {
    animFrameId = requestAnimationFrame(animate);
    if (!paused) {
      eventTimer += 1 / 60;
      if (eventTimer >= eventFrequency) { eventTimer = 0; fireEvent(); }
      const ds = driftSpeed, ng = numGroups, n = numChords;
      for (let i = 0; i < n; i++) {
        const c = chords[i];
        const tgt = c.mode === 'correlated'
          ? Math.max(-1, Math.min(1, (groupTargets[Math.min(c.baseIdx!, ng - 1)] || 0) + (c.noiseOffset || 0)))
          : (c.target ?? 0);
        c.value = Math.max(-1, Math.min(1, c.value + (tgt - c.value) * ds));
      }
      for (let i = 0; i < departingChords.length; i++) { departingChords[i].departT = Math.min(1, (departingChords[i].departT || 0) + 1 / 30); }
      for (let i = 0; i < chords.length; i++) { if (chords[i].arrivalT < 1) chords[i].arrivalT = Math.min(1, chords[i].arrivalT + 1 / 30); }
    }
    for (let i = 0; i < liveChords.length; i++) {
      const lc = liveChords[i];
      if (lc.departT != null) { lc.departT = Math.min(1, lc.departT + 1 / 30); }
      else { lc.arrivalT = Math.min(1, (lc.arrivalT || 0) + 1 / 30); }
    }

    const tTarget = viewMode === '3d' ? 1 : 0;
    transT = clamp01(transT + (tTarget - transT) * TRANS_SPEED * 3);
    if (viewMode !== '3d') orbitDRadius += (0 - orbitDRadius) * TRANS_SPEED * 3;
    const ttsTarget = viewMode === '2d-ts' ? 1 : 0;
    transTts = clamp01(transTts + (ttsTarget - transTts) * TRANS_SPEED * 3);
    const gTarget = geoMode === 'radial' ? 1 : geoMode === 'linear' ? -1 : geoMode === 'parallel' ? -2 : 0;
    morphT = Math.max(-2, Math.min(1, morphT + (gTarget - morphT) * 0.05));
    if (geoMode === 'parallel' && morphT > -1) inParallelTransition = true;
    if (geoMode === 'linear') inParallelTransition = false;
    if (geoMode !== 'parallel' && morphT > -0.05) inParallelTransition = false;
    if (geoMode === 'radial' && morphT < 0) inParallelRadialTransition = true;
    if (geoMode === 'parallel' && morphT > 0) inParallelRadialTransition = true;
    if (geoMode === 'diametric' || geoMode === 'linear') inParallelRadialTransition = false;
    if (geoMode === 'radial' && morphT > 0.95) inParallelRadialTransition = false;
    if (geoMode === 'parallel' && morphT < -1.95) inParallelRadialTransition = false;

    lerpCam(ease(transT));
    if (transTts > 0) {
      const et = ease(transTts);
      camRadius += (CAM_2D_TS.radius - camRadius) * et;
      camTheta += (CAM_2D_TS.theta - camTheta) * et;
      camPhi += (CAM_2D_TS.phi - camPhi) * et;
    }
    applyCam();

    const depthA = ease(transT);
    const depthTs = ease(transTts);
    zAxisMat.opacity = Math.max(depthA, depthTs) * 0.45;
    ghostRings.forEach((r, i) => { (r.material as THREE.LineBasicMaterial).opacity = depthA * (0.12 - i * 0.03); r.visible = depthA > 0.02; });

    const n = numChords;
    let p1: number, p2: number, pp1: number, pp2: number, lp1: number, lp2: number;
    if (animMode === 'simultaneous' && inParallelRadialTransition) { const te = ease(clamp01((morphT + 2) / 3)); p1 = te; p2 = te; pp1 = 1 - te; pp2 = 1 - te; lp1 = 0; lp2 = 0; }
    else if (morphT >= 0) { ({ p1, p2 } = getPhases(morphT, geoMode === 'radial')); pp1 = 0; pp2 = 0; lp1 = 0; lp2 = 0; }
    else if (animMode === 'simultaneous' && inParallelTransition) { p1 = 0; p2 = 0; lp1 = 0; lp2 = 0; const pb = ease(-morphT / 2); pp1 = pb; pp2 = pb; }
    else if (morphT >= -1) { p1 = 0; p2 = 0; pp1 = 0; pp2 = 0; const le = ease(-morphT); lp1 = le; lp2 = le; }
    else { p1 = 0; p2 = 0; pp1 = 1; pp2 = 1; const le = ease(2 + morphT); lp1 = le; lp2 = le; }

    (midRing.material as THREE.LineBasicMaterial).opacity = p1 * 0.35;

    for (let i = 0; i < MAX_N; i++) {
      const di = i - n;
      const c = i < n ? chords[i] : (di >= 0 && di < departingChords.length ? departingChords[di] : null);
      const ci = c && c.departI != null ? c.departI : i;
      const cn = c && c.departN != null ? c.departN : n;
      let effI = ci, effN = cn;
      if (entryMode === 'persistent' && c && c.baseIdx != null && orderMode === 'grouped') {
        if (c.departI == null) {
          const ng = numGroups, g = c.baseIdx;
          let localCount = 0, localIdx = 0;
          for (let k = 0; k < chords.length; k++) { if (chords[k].baseIdx === g) { if (k === i) localIdx = localCount; localCount++; } }
          if (localCount > 0) {
            const fw = FIBS.slice(0, ng), ftot = fw.reduce((a, b) => a + b, 0);
            let cumW = 0; for (let gg = 0; gg < g; gg++) cumW += fw[gg];
            effI = cumW * localCount + localIdx * fw[g]; effN = ftot * localCount;
          }
        } else if (c.departEffI != null) { effI = c.departEffI; effN = c.departEffN!; }
      }
      if (c) {
        const doAnim = exitAnim === 'origin';
        const aT = c.arrivalT != null ? c.arrivalT : 1;
        const dT = c.departT != null ? c.departT : 0;
        const vScale = doAnim ? (c.departT != null ? 1 - dT * dT : aT * aT) : 1;
        const v = c.value * vScale;
        const { rootX, rootY, tipX, tipY } = getChordPoints(effI, effN, v, p1, p2, pp1, pp2, lp1, lp2);
        const [rx, ry, rz] = cv(rootX, rootY); const [tx, ty, tz] = cv(tipX, tipY);
        chordPosArr.set([rx, ry, rz, tx, ty, tz], i * 6);
        const rc = neutralRGBA(opacities.radial), tc2 = elementRGBA(c, v, styles.radial, opacities.radial);
        chordColArr.set([rc[0] / 255, rc[1] / 255, rc[2] / 255, tc2[0] / 255, tc2[1] / 255, tc2[2] / 255], i * 6);
        dotPosArr.set([tx, ty, tz], i * 3);
        const dc = elementRGBA(c, v, styles.cursor, opacities.cursor);
        dotColArr.set([dc[0] / 255, dc[1] / 255, dc[2] / 255], i * 3);
        if (!paused) { c.history.push([tx, ty, rx, ry, c.value]); if (c.history.length > TRACE_LEN) c.history.shift(); }
        if (showGuides && i < n) {
          const { posX, posY, negX, negY } = getGuidePoints(effI, effN, p1, p2, pp1, pp2, lp1, lp2);
          const [px, py, pz] = cv(posX, posY); const [qx, qy, qz] = cv(negX, negY);
          guidePosArr.set([px, py, pz, qx, qy, qz], i * 6);
          const ga = 0.18 * opacities.radial;
          guideColArr.set([ga, ga, ga, ga, ga, ga], i * 6);
        } else { guidePosArr.fill(0, i * 6, (i + 1) * 6); guideColArr.fill(0, i * 6, (i + 1) * 6); }
      } else {
        chordPosArr.fill(0, i * 6, (i + 1) * 6); chordColArr.fill(0, i * 6, (i + 1) * 6);
        dotPosArr.fill(0, i * 3, (i + 1) * 3); dotColArr.fill(0, i * 3, (i + 1) * 3);
        guidePosArr.fill(0, i * 6, (i + 1) * 6); guideColArr.fill(0, i * 6, (i + 1) * 6);
      }
    }
    for (let i = departingChords.length - 1; i >= 0; i--) { if ((departingChords[i].departT || 0) >= 1) departingChords.splice(i, 1); }

    if (useGeo) {
      (chordGeo.attributes as any).instanceStart.data.needsUpdate = true;
      (chordGeo.attributes as any).instanceColorStart.data.needsUpdate = true;
    } else {
      chordGeoBasic.attributes.position.needsUpdate = true;
      chordGeoBasic.attributes.color.needsUpdate = true;
    }
    chordLines.visible = useGeo && lineW > 0;
    chordLinesBasic.visible = !useGeo;
    dotGeo.attributes.position.needsUpdate = true;
    dotGeo.attributes.color.needsUpdate = true;
    guideGeo.attributes.position.needsUpdate = true;
    guideGeo.attributes.color.needsUpdate = true;
    chordMat.linewidth = lineW;
    chordMat.opacity = opacities.radial;
    chordMatBasic.opacity = opacities.radial;
    dotMat.size = Math.max(0.01, dotBase / 2);
    dotMat.opacity = opacities.cursor;

    // Live chord geometry
    {
      const nLive = liveChords.length;
      for (let i = 0; i < MAX_LIVE; i++) {
        const lc = i < nLive ? liveChords[i] : null;
        if (lc) {
          const aT = lc.arrivalT || 0;
          const dT = lc.departT != null ? lc.departT : 0;
          const vScale = exitAnim === 'origin' ? (lc.departT != null ? 1 - dT * dT : aT * aT) : 1;
          const v = lc.value * vScale;
          const { rootX, rootY, tipX, tipY } = getChordPoints(i, Math.max(nLive, 1), v, p1, p2, pp1, pp2, lp1, lp2);
          const [rx, ry, rz] = cv(rootX, rootY); const [tx, ty, tz] = cv(tipX, tipY);
          liveCPosArr.set([rx, ry, rz, tx, ty, tz], i * 6);
          const nc = neutralRGBA(opacities.radial);
          const tc2 = liveElementRGBA(v, styles.radial, opacities.radial);
          liveCColArr.set([nc[0] / 255, nc[1] / 255, nc[2] / 255, tc2[0] / 255, tc2[1] / 255, tc2[2] / 255], i * 6);
          if (lc.hasTouched && !lc.lifted) {
            liveDPosArr.set([tx, ty, tz], i * 3);
            const dc = liveElementRGBA(v, styles.cursor, opacities.cursor);
            liveDColArr.set([dc[0] / 255, dc[1] / 255, dc[2] / 255], i * 3);
          } else { liveDPosArr.fill(0, i * 3, (i + 1) * 3); liveDColArr.fill(0, i * 3, (i + 1) * 3); }
          if (lc.hasTouched && !paused && lc.departT == null) { lc.history.push([tx, ty, rx, ry, lc.value]); if (lc.history.length > TRACE_LEN) lc.history.shift(); }
        } else {
          liveCPosArr.fill(0, i * 6, (i + 1) * 6); liveCColArr.fill(0, i * 6, (i + 1) * 6);
          liveDPosArr.fill(0, i * 3, (i + 1) * 3); liveDColArr.fill(0, i * 3, (i + 1) * 3);
        }
      }
      (liveCGeo.attributes as any).instanceStart.data.needsUpdate = true;
      (liveCGeo.attributes as any).instanceColorStart.data.needsUpdate = true;
      liveDGeo.attributes.position.needsUpdate = true;
      liveDGeo.attributes.color.needsUpdate = true;
      liveCMat.opacity = opacities.radial; liveCMat.linewidth = lineW;
      liveCLines.visible = useGeo && lineW > 0 && nLive > 0;
      liveDMat.size = Math.max(0.01, dotBase / 2); liveDMat.opacity = opacities.cursor;
      liveDPoints.visible = dotBase > 0 && nLive > 0;
    }
    for (let i = liveChords.length - 1; i >= 0; i--) { if ((liveChords[i].departT || 0) >= 1) liveChords.splice(i, 1); }

    // Trace lines
    const showTrace = viewMode === '2d-ts' || viewMode === '3d';
    const bgR = 15, bgG = 15, bgB = 14;
    for (let i = 0; i < MAX_N; i++) {
      const di = i - n;
      const c = i < n ? chords[i] : (di >= 0 && di < departingChords.length ? departingChords[di] : null);
      const hlen = c ? c.history.length : 0;
      for (let j = 0; j < TRACE_SEGS; j++) {
        const base = (i * TRACE_SEGS + j) * 6;
        if (showTrace && c && j + 1 < hlen) {
          const [ax, ay] = c.history[j]; const [bx, by] = c.history[j + 1];
          const zA = -(hlen - 1 - j) * TRACE_Z_STEP; const zB = -(hlen - 1 - (j + 1)) * TRACE_Z_STEP;
          const fadeA = j / (hlen - 1); const fadeB = (j + 1) / (hlen - 1);
          const tc2 = elementRGBA(c, stylePastLikeCursor ? c.value : (c.history[j][4] ?? c.value), styles.trace, 1);
          const cr = tc2[0], cg = tc2[1], cb = tc2[2];
          const rA = (bgR + (cr - bgR) * fadeA) / 255, gA = (bgG + (cg - bgG) * fadeA) / 255, bA = (bgB + (cb - bgB) * fadeA) / 255;
          const rB = (bgR + (cr - bgR) * fadeB) / 255, gB = (bgG + (cg - bgG) * fadeB) / 255, bB = (bgB + (cb - bgB) * fadeB) / 255;
          tracePosArr.set([ax, ay, zA, bx, by, zB], base);
          traceColArr.set([rA, gA, bA, rB, gB, bB], base);
        } else {
          tracePosArr.fill(0, base, base + 6);
          traceColArr.set([bgR / 255, bgG / 255, bgB / 255, bgR / 255, bgG / 255, bgB / 255], base);
        }
      }
    }
    traceGeo.attributes.position.needsUpdate = true;
    traceGeo.attributes.color.needsUpdate = true;
    traceMat.opacity = opacities.trace;
    traceLines.visible = showTrace;

    // Fill surfaces (history stores [tipX, tipY, rootX, rootY, value] all in Three.js world space)
    for (let i = 0; i < MAX_N; i++) {
      const di = i - n;
      const c = i < n ? chords[i] : (di >= 0 && di < departingChords.length ? departingChords[di] : null);
      const hlen = c ? c.history.length : 0;
      for (let j = 0; j < TRACE_SEGS; j++) {
        const base = (i * TRACE_SEGS + j) * FILL_VERTS_PER_SEG * 3;
        if (showTrace && c && j + 1 < hlen) {
          const [ax, ay, orx, ory] = c.history[j];
          const [bx, by, brx, bry] = c.history[j + 1];
          const zA = -(hlen - 1 - j) * TRACE_Z_STEP; const zB = -(hlen - 1 - (j + 1)) * TRACE_Z_STEP;
          const fadeA = j / (hlen - 1); const fadeB = (j + 1) / (hlen - 1);
          const fc = elementRGBA(c, stylePastLikeCursor ? c.value : (c.history[j][4] ?? c.value), styles.fill, 1);
          const fr = fc[0], fg = fc[1], fb = fc[2];
          const rA = (bgR + (fr - bgR) * fadeA) / 255, gA = (bgG + (fg - bgG) * fadeA) / 255, bA = (bgB + (fb - bgB) * fadeA) / 255;
          const rB = (bgR + (fr - bgR) * fadeB) / 255, gB = (bgG + (fg - bgG) * fadeB) / 255, bB2 = (bgB + (fb - bgB) * fadeB) / 255;
          const oR = bgR / 255, oG = bgG / 255, oB2 = bgB / 255;
          // Two triangles: (origin-A, tip-A, origin-B), (tip-A, tip-B, origin-B)
          fillPosArr.set([orx, ory, zA, ax, ay, zA, brx, bry, zB, ax, ay, zA, bx, by, zB, brx, bry, zB], base);
          fillColArr.set([oR, oG, oB2, rA, gA, bA, oR, oG, oB2, rA, gA, bA, rB, gB, bB2, oR, oG, oB2], base);
        } else {
          fillPosArr.fill(0, base, base + FILL_VERTS_PER_SEG * 3);
          fillColArr.fill(bgR / 255, base, base + FILL_VERTS_PER_SEG * 3);
        }
      }
    }
    fillGeo.attributes.position.needsUpdate = true;
    fillGeo.attributes.color.needsUpdate = true;
    fillMat.opacity = opacities.fill;
    fillMesh.visible = showTrace;

    // Live trace & fill
    for (let i = 0; i < MAX_LIVE; i++) {
      const lc = i < liveChords.length ? liveChords[i] : null;
      const hlen = lc ? lc.history.length : 0;
      for (let j = 0; j < TRACE_SEGS; j++) {
        const base = (i * TRACE_SEGS + j) * 6;
        if (showTrace && lc && lc.hasTouched && j + 1 < hlen) {
          const [ax, ay] = lc.history[j]; const [bx, by] = lc.history[j + 1];
          const zA = -(hlen - 1 - j) * TRACE_Z_STEP; const zB = -(hlen - 1 - (j + 1)) * TRACE_Z_STEP;
          const fadeA = j / (hlen - 1); const fadeB = (j + 1) / (hlen - 1);
          const tc2 = liveElementRGBA(stylePastLikeCursor ? lc.value : (lc.history[j][4] ?? lc.value), styles.trace, 1);
          const cr = tc2[0], cg = tc2[1], cb = tc2[2];
          liveTrPosArr.set([ax, ay, zA, bx, by, zB], base);
          liveTrColArr.set([(bgR + (cr - bgR) * fadeA) / 255, (bgG + (cg - bgG) * fadeA) / 255, (bgB + (cb - bgB) * fadeA) / 255, (bgR + (cr - bgR) * fadeB) / 255, (bgG + (cg - bgG) * fadeB) / 255, (bgB + (cb - bgB) * fadeB) / 255], base);
        } else {
          liveTrPosArr.fill(0, base, base + 6);
          liveTrColArr.set([bgR / 255, bgG / 255, bgB / 255, bgR / 255, bgG / 255, bgB / 255], base);
        }
      }
      for (let j = 0; j < TRACE_SEGS; j++) {
        const base = (i * TRACE_SEGS + j) * FILL_VERTS_PER_SEG * 3;
        liveFiPosArr.fill(0, base, base + FILL_VERTS_PER_SEG * 3);
        liveFiColArr.fill(0, base, base + FILL_VERTS_PER_SEG * 3);
      }
    }
    liveTrGeo.attributes.position.needsUpdate = true;
    liveTrGeo.attributes.color.needsUpdate = true;
    liveTrMat.opacity = opacities.trace;
    liveTrLines.visible = showTrace;
    liveFiGeo.attributes.position.needsUpdate = true;
    liveFiGeo.attributes.color.needsUpdate = true;

    renderer.render(scene, camera);
  }

  animate();

  // ── Public API ──────────────────────────────────────────
  function applyConfig(config: VizConfig) {
    const chordsChanged = config.chords !== numChords || config.groups !== numGroups || config.traces !== traceMode || config.order !== orderMode;
    const reinitChords = config.traces !== traceMode || config.order !== orderMode;

    numChords = config.chords;
    numGroups = config.groups;
    showGuides = config.showGuides;
    geoMode = config.geometry;
    animMode = config.animation;
    exitAnim = config.exitAnimation;
    entryMode = config.chordPersistence;
    lineW = config.radialWidth;
    dotBase = config.cursorSize;
    eventFrequency = config.eventFrequency;
    driftSpeed = config.driftSpeed;
    useGeo = config.useGeometry;
    stylePastLikeCursor = config.stylePastLikeCursor;
    styles.cursor = config.cursorStyle;
    styles.radial = config.radialStyle;
    styles.trace = config.traceStyle;
    styles.fill = config.fillStyle;
    opacities.cursor = config.cursorOpacity;
    opacities.radial = config.radialOpacity;
    colors.pos = { ...hexToRgb(config.colorPositive), a: 1 };
    colors.neg = { ...hexToRgb(config.colorNegative), a: 1 };
    colors.neutral = { ...hexToRgb(config.colorNeutral), a: 1 };

    if (reinitChords) { traceMode = config.traces; orderMode = config.order; initChords(); }
    else if (chordsChanged) { traceMode = config.traces; orderMode = config.order; updateChordCount(); }

    if (config.viewMode !== viewMode) {
      viewMode = config.viewMode;
      if (viewMode === '2d' || viewMode === '2d-ts') { orbitDTheta = 0; orbitDPhi = 0; }
    }
  }

  function applyCamera(state: VizCameraState) {
    if (state.viewMode !== viewMode) {
      viewMode = state.viewMode;
      if (viewMode === '2d' || viewMode === '2d-ts') { orbitDTheta = 0; orbitDPhi = 0; }
    }
    orbitDTheta = state.theta - camTheta;
    orbitDPhi = state.phi - camPhi;
    orbitDRadius = state.radius - camRadius;
  }

  function dispose() {
    cancelAnimationFrame(animFrameId);
    resizeObserver.disconnect();
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    renderer.dispose();
    if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
  }

  return { applyConfig, applyCamera, dispose };
}
