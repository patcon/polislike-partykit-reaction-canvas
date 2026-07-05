import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { usePanelContext } from '../../app/context/PanelContext';
import { useValenceStream } from '../../app/hooks/useValenceStream';

// Ported from public/valence-onboarding-v3.html — the "cross-section" concept:
// live participants' valence rendered as chords (root at center, tip displaced
// by valence) across four interchangeable geometries, in three camera views.
//
// Deliberately minimal vs. the original standalone page: no simulated/background
// chords (real useValenceStream users only), no particle-physics geometry, no
// config UI (colors/opacity/line-width/etc. are fixed constants below). The only
// interactive surface is the view/geometry cycle buttons.

type ViewMode = '2d' | '2d-ts' | '3d';
type GeoMode = 'parallel' | 'linear' | 'diametric' | 'radial';

const VIEW_MODES: ViewMode[] = ['2d', '2d-ts', '3d'];
const GEO_MODES: GeoMode[] = ['parallel', 'linear', 'diametric', 'radial'];

const VIEW_LABELS: Record<ViewMode, string> = {
  '2d': '2d time slice',
  '2d-ts': '2d time series',
  '3d': '3d',
};

// ── Fixed layout constants (canvas-space, matches v3's 480×480 authoring space) ──
const CENTER = 240;
const R = 180;
const R_MID = 90;
const MAX_CHORDS = 48;
const TRACE_LEN = 300;
const TRACE_SEGS = TRACE_LEN - 1;
const TRACE_Z_STEP = 6;
const FILL_VERTS_PER_SEG = 6;
const DOT_SIZE = 20;
const DRIFT = 0.12; // smoothing toward latest cursor valence, avoids per-frame jitter
const TRANS_SPEED = 0.04;

// ── Fixed styling (no config UI — see module comment) ──
const COLORS = {
  pos: { r: 80, g: 255, b: 140, a: 1 },
  neg: { r: 255, g: 80, b: 60, a: 1 },
  neutral: { r: 15, g: 15, b: 14, a: 1 },
};
const OPACITIES = { radial: 1, cursor: 1, trace: 0.8, fill: 0.45 };

function ease(t: number) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
function clamp01(t: number) { return Math.min(1, Math.max(0, t)); }

function valenceRGB(v: number): [number, number, number] {
  const t = Math.pow(Math.abs(v), 0.55);
  const { r: nr, g: ng, b: nb } = COLORS.neutral;
  const src = v >= 0 ? COLORS.pos : COLORS.neg;
  return [Math.round(nr + (src.r - nr) * t), Math.round(ng + (src.g - ng) * t), Math.round(nb + (src.b - nb) * t)];
}
function elementRGBA(v: number, op: number): [number, number, number, number] {
  const [r, g, b] = valenceRGB(v);
  const t = Math.pow(Math.abs(v), 0.55);
  const srcA = v >= 0 ? COLORS.pos.a : COLORS.neg.a;
  const a = (COLORS.neutral.a + (srcA - COLORS.neutral.a) * t) * op;
  return [r, g, b, Math.min(1, Math.max(0, a))];
}
function neutralRGBA(op: number): [number, number, number, number] {
  const { r, g, b, a } = COLORS.neutral;
  return [r, g, b, a * op];
}

// Canvas coords (0..480, Y-down) → Three.js world (centered, Y-up)
function cv(x: number, y: number): [number, number, number] { return [x - CENTER, CENTER - y, 0]; }

// animMode is fixed to 'sequential' (v3's default) — no simultaneous mode, no UI to pick it.
function getPhases(mt: number, toRadial: boolean) {
  if (toRadial) return { p1: ease(clamp01(mt * 2)), p2: ease(clamp01((mt - 0.5) * 2)) };
  const rev = 1 - mt;
  return { p2: 1 - ease(clamp01(rev * 2)), p1: 1 - ease(clamp01((rev - 0.5) * 2)) };
}

function getChordPoints(
  i: number, n: number, v: number,
  p1: number, p2: number, pp1: number, pp2: number, lp1: number, lp2: number,
) {
  const tilt = (Math.PI / n) * 0.5, absV = Math.abs(v);
  const dAx = (i / n) * Math.PI + tilt;
  const dTA = v >= 0 ? dAx + Math.PI : dAx;
  const dTX = CENTER + Math.cos(dTA) * R * absV, dTY = CENTER + Math.sin(dTA) * R * absV;
  const rSA = (i / n) * 2 * Math.PI + tilt - Math.PI / 2;
  let sd = rSA - dAx;
  while (sd > Math.PI) sd -= 2 * Math.PI;
  while (sd < -Math.PI) sd += 2 * Math.PI;
  const sa = dAx + sd * p2, sc = Math.cos(sa), ss = Math.sin(sa);
  const rRX = CENTER + sc * R_MID, rRY = CENTER + ss * R_MID, rTR = R_MID * (1 - v);
  let rootX = CENTER + (rRX - CENTER) * p1, rootY = CENTER + (rRY - CENTER) * p1;
  let tipX = dTX + (CENTER + sc * rTR - dTX) * p1, tipY = dTY + (CENTER + ss * rTR - dTY) * p1;
  if (pp1 > 0 || pp2 > 0) {
    const pX = n > 1 ? CENTER + (i - (n - 1) / 2) / (n - 1) * 2 * R : CENTER;
    rootX += (pX - rootX) * pp1; rootY += (CENTER - rootY) * pp1;
    tipX += (pX - tipX) * pp2; tipY += (CENTER - R * v - tipY) * pp2;
  }
  if (lp1 > 0 || lp2 > 0) {
    rootX += (CENTER - rootX) * lp1; rootY += (CENTER - rootY) * lp1;
    tipX += (CENTER - tipX) * lp2; tipY += (CENTER - R * v - tipY) * lp2;
  }
  return { rootX, rootY, tipX, tipY };
}

function makeRingLine(radius: number, z: number, color: number, opacity: number) {
  const N = 128;
  const arr = new Float32Array((N + 1) * 3);
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    arr[i * 3] = Math.cos(a) * radius; arr[i * 3 + 1] = Math.sin(a) * radius; arr[i * 3 + 2] = z;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
  return new THREE.Line(geo, mat);
}

interface ChordEntry {
  userId: string;
  raw: number;
  value: number;
  arrivalT: number;
  departT: number | null;
  departI?: number;
  departN?: number;
  // [tipX, tipY, rootX, rootY, valueAtTime] in world space, oldest first
  history: [number, number, number, number, number][];
}

interface Actions {
  cycleView: () => void;
  cycleGeometry: () => void;
}

export default function ValenceCrossSectionPanel() {
  const { userId } = usePanelContext();
  // includeSelf: this is a presentation viz, matches sibling plugins (moodTones/boids).
  const { getValences } = useValenceStream(userId, { mode: 'continuous', includeSelf: true });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<Actions | null>(null);

  const [viewMode, setViewModeDisplay] = useState<ViewMode>('2d');
  const [geoMode, setGeoModeDisplay] = useState<GeoMode>('diametric');

  useEffect(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const W = wrap.clientWidth, H = wrap.clientHeight;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x0f0f0e, 1);
    renderer.setSize(W, H);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(53.13, W / H, 0.1, 10000);

    // ── Scene objects ──────────────────────────────────────────────────
    const outerRing = makeRingLine(R, 0, 0x383835, 0.8);
    scene.add(outerRing);
    const midRing = makeRingLine(R_MID, 0, 0x2a2a28, 0);
    scene.add(midRing);
    const ghostRings = [-120, -240, -360].map((z) => {
      const r = makeRingLine(R, z, 0x1e1e1c, 0);
      scene.add(r);
      return r;
    });
    const zAxisMat = new THREE.LineBasicMaterial({ color: 0x404040, transparent: true, opacity: 0 });
    {
      const arr = new Float32Array([0, 0, 0, 0, 0, -420]);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      scene.add(new THREE.Line(geo, zAxisMat));
    }
    {
      const N = 48, arr = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2; arr[i * 3] = Math.cos(a) * R; arr[i * 3 + 1] = Math.sin(a) * R; }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x3a3935, size: 3, sizeAttenuation: true })));
    }

    const chordPosArr = new Float32Array(MAX_CHORDS * 2 * 3);
    const chordColArr = new Float32Array(MAX_CHORDS * 2 * 3);
    const chordGeo = new THREE.BufferGeometry();
    chordGeo.setAttribute('position', new THREE.BufferAttribute(chordPosArr, 3));
    chordGeo.setAttribute('color', new THREE.BufferAttribute(chordColArr, 3));
    const chordMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false });
    const chordLines = new THREE.LineSegments(chordGeo, chordMat);
    chordLines.renderOrder = 7;
    scene.add(chordLines);

    const dotPosArr = new Float32Array(MAX_CHORDS * 3);
    const dotColArr = new Float32Array(MAX_CHORDS * 3);
    const dotGeo = new THREE.BufferGeometry();
    dotGeo.setAttribute('position', new THREE.BufferAttribute(dotPosArr, 3));
    dotGeo.setAttribute('color', new THREE.BufferAttribute(dotColArr, 3));
    const dotMat = new THREE.PointsMaterial({ vertexColors: true, size: DOT_SIZE / 2, sizeAttenuation: true, transparent: true, depthWrite: false });
    const dotPoints = new THREE.Points(dotGeo, dotMat);
    dotPoints.renderOrder = 10;
    scene.add(dotPoints);

    const tracePosArr = new Float32Array(MAX_CHORDS * TRACE_SEGS * 2 * 3);
    const traceColArr = new Float32Array(MAX_CHORDS * TRACE_SEGS * 2 * 3);
    const traceGeo = new THREE.BufferGeometry();
    traceGeo.setAttribute('position', new THREE.BufferAttribute(tracePosArr, 3));
    traceGeo.setAttribute('color', new THREE.BufferAttribute(traceColArr, 3));
    const traceMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false });
    const traceLines = new THREE.LineSegments(traceGeo, traceMat);
    traceLines.renderOrder = 5;
    scene.add(traceLines);

    const fillPosArr = new Float32Array(MAX_CHORDS * TRACE_SEGS * FILL_VERTS_PER_SEG * 3);
    const fillColArr = new Float32Array(MAX_CHORDS * TRACE_SEGS * FILL_VERTS_PER_SEG * 3);
    const fillGeo = new THREE.BufferGeometry();
    fillGeo.setAttribute('position', new THREE.BufferAttribute(fillPosArr, 3));
    fillGeo.setAttribute('color', new THREE.BufferAttribute(fillColArr, 3));
    const fillMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const fillMesh = new THREE.Mesh(fillGeo, fillMat);
    fillMesh.renderOrder = 4;
    scene.add(fillMesh);

    // ── Camera ───────────────────────────────────────────────────────
    let camRadius = 480, camTheta = 0, camPhi = 0;
    const CAM_2D = { radius: 480, theta: 0, phi: 0 };
    const CAM_2D_TS = { radius: 480, theta: Math.PI / 2, phi: 0 };
    const CAM_3D = { radius: 560, theta: Math.PI / 5, phi: Math.PI / 9 };
    let transT = 0, transTts = 0;

    function lerpCam(et: number) {
      camRadius = CAM_2D.radius + (CAM_3D.radius - CAM_2D.radius) * et;
      camTheta = CAM_2D.theta + (CAM_3D.theta - CAM_2D.theta) * et;
      camPhi = CAM_2D.phi + (CAM_3D.phi - CAM_2D.phi) * et;
    }
    function applyCam() {
      camera.position.set(
        camRadius * Math.sin(camTheta) * Math.cos(camPhi),
        camRadius * Math.sin(camPhi),
        camRadius * Math.cos(camTheta) * Math.cos(camPhi),
      );
      camera.lookAt(0, 0, 0);
      camera.up.set(0, 1, 0);
    }

    // ── Mode state (mutated directly by button actions, read every frame) ──
    let viewModeLocal: ViewMode = '2d';
    let geoModeLocal: GeoMode = 'diametric';
    let morphT = 0;

    actionsRef.current = {
      cycleView: () => {
        viewModeLocal = VIEW_MODES[(VIEW_MODES.indexOf(viewModeLocal) + 1) % VIEW_MODES.length];
        setViewModeDisplay(viewModeLocal);
      },
      cycleGeometry: () => {
        geoModeLocal = GEO_MODES[(GEO_MODES.indexOf(geoModeLocal) + 1) % GEO_MODES.length];
        setGeoModeDisplay(geoModeLocal);
      },
    };

    // ── Live chord state (from useValenceStream — no simulated chords) ──
    let chords: ChordEntry[] = [];
    let departing: ChordEntry[] = [];

    function reconcile(valences: Map<string, number>) {
      for (const [uid, v] of valences) {
        const existing = chords.find((c) => c.userId === uid);
        if (existing) { existing.raw = v; continue; }
        const depIdx = departing.findIndex((c) => c.userId === uid);
        if (depIdx >= 0) {
          const [c] = departing.splice(depIdx, 1);
          c.departT = null; c.departI = undefined; c.departN = undefined; c.raw = v;
          chords.push(c);
          continue;
        }
        chords.push({ userId: uid, raw: v, value: v, arrivalT: 0, departT: null, history: [] });
      }
      const n = chords.length;
      for (let i = chords.length - 1; i >= 0; i--) {
        const c = chords[i];
        if (!valences.has(c.userId)) {
          c.departT = 0; c.departI = i; c.departN = n;
          departing.push(c);
          chords.splice(i, 1);
        }
      }
    }

    function advanceTimers() {
      chords.forEach((c) => {
        c.arrivalT = Math.min(1, c.arrivalT + 1 / 30);
        c.value += (c.raw - c.value) * DRIFT;
      });
      for (let i = departing.length - 1; i >= 0; i--) {
        const c = departing[i];
        c.departT = Math.min(1, (c.departT ?? 0) + 1 / 30);
        if (c.departT >= 1) departing.splice(i, 1);
      }
    }

    // ── Render loop ────────────────────────────────────────────────────
    let animFrameId = 0;
    function animate() {
      animFrameId = requestAnimationFrame(animate);

      reconcile(getValences());
      advanceTimers();

      const tTarget = viewModeLocal === '3d' ? 1 : 0;
      transT = clamp01(transT + (tTarget - transT) * TRANS_SPEED * 3);
      const ttsTarget = viewModeLocal === '2d-ts' ? 1 : 0;
      transTts = clamp01(transTts + (ttsTarget - transTts) * TRANS_SPEED * 3);
      lerpCam(ease(transT));
      if (transTts > 0) {
        const et = ease(transTts);
        camRadius += (CAM_2D_TS.radius - camRadius) * et;
        camTheta += (CAM_2D_TS.theta - camTheta) * et;
        camPhi += (CAM_2D_TS.phi - camPhi) * et;
      }
      applyCam();

      const depthA = ease(transT), depthTs = ease(transTts);
      zAxisMat.opacity = Math.max(depthA, depthTs) * 0.45;
      ghostRings.forEach((r, i) => { r.material.opacity = depthA * (0.12 - i * 0.03); r.visible = depthA > 0.02; });

      const gTarget = geoModeLocal === 'radial' ? 1 : geoModeLocal === 'linear' ? -1 : geoModeLocal === 'parallel' ? -2 : 0;
      morphT = Math.max(-2, Math.min(1, morphT + (gTarget - morphT) * 0.05));
      let p1: number, p2: number, pp1: number, pp2: number, lp1: number, lp2: number;
      if (morphT >= 0) {
        ({ p1, p2 } = getPhases(morphT, geoModeLocal === 'radial'));
        pp1 = 0; pp2 = 0; lp1 = 0; lp2 = 0;
      } else if (morphT >= -1) {
        p1 = 0; p2 = 0; pp1 = 0; pp2 = 0;
        const le = ease(-morphT); lp1 = le; lp2 = le;
      } else {
        p1 = 0; p2 = 0; pp1 = 1; pp2 = 1;
        const le = ease(2 + morphT); lp1 = le; lp2 = le;
      }
      midRing.material.opacity = p1 * 0.35;

      const showTrace = viewModeLocal === '2d-ts' || viewModeLocal === '3d';
      const bgR = 15, bgG = 15, bgB = 14;
      const all: ChordEntry[] = [...chords, ...departing];
      const n = chords.length;

      for (let i = 0; i < MAX_CHORDS; i++) {
        const c = i < all.length ? all[i] : null;
        if (c) {
          const effI = c.departI != null ? c.departI : i;
          const effN = c.departN != null ? c.departN : n;
          const dT = c.departT ?? 0;
          const vScale = c.departT != null ? 1 - dT * dT : c.arrivalT * c.arrivalT;
          const v = c.value * vScale;
          const { rootX, rootY, tipX, tipY } = getChordPoints(effI, effN, v, p1, p2, pp1, pp2, lp1, lp2);
          const [rx, ry, rz] = cv(rootX, rootY);
          const [tx, ty, tz] = cv(tipX, tipY);
          chordPosArr.set([rx, ry, rz, tx, ty, tz], i * 6);
          const rc = neutralRGBA(OPACITIES.radial), tc = elementRGBA(v, OPACITIES.radial);
          chordColArr.set([rc[0] / 255, rc[1] / 255, rc[2] / 255, tc[0] / 255, tc[1] / 255, tc[2] / 255], i * 6);
          dotPosArr.set([tx, ty, tz], i * 3);
          const dc = elementRGBA(v, OPACITIES.cursor);
          dotColArr.set([dc[0] / 255, dc[1] / 255, dc[2] / 255], i * 3);
          c.history.push([tx, ty, rx, ry, c.value]);
          if (c.history.length > TRACE_LEN) c.history.shift();
        } else {
          chordPosArr.fill(0, i * 6, (i + 1) * 6); chordColArr.fill(0, i * 6, (i + 1) * 6);
          dotPosArr.fill(0, i * 3, (i + 1) * 3); dotColArr.fill(0, i * 3, (i + 1) * 3);
        }
      }
      chordGeo.attributes.position.needsUpdate = true; chordGeo.attributes.color.needsUpdate = true;
      dotGeo.attributes.position.needsUpdate = true; dotGeo.attributes.color.needsUpdate = true;

      for (let i = 0; i < MAX_CHORDS; i++) {
        const c = i < all.length ? all[i] : null;
        const hlen = c ? c.history.length : 0;
        for (let j = 0; j < TRACE_SEGS; j++) {
          const base = (i * TRACE_SEGS + j) * 6;
          const fbase = (i * TRACE_SEGS + j) * FILL_VERTS_PER_SEG * 3;
          if (showTrace && c && j + 1 < hlen) {
            const [ax, ay, orx, ory] = c.history[j];
            const [bx, by, brx, bry] = c.history[j + 1];
            const zA = -(hlen - 1 - j) * TRACE_Z_STEP, zB = -(hlen - 1 - (j + 1)) * TRACE_Z_STEP;
            const fadeA = j / (hlen - 1), fadeB = (j + 1) / (hlen - 1);
            const [tR, tG, tB] = elementRGBA(c.history[j][4], 1);
            const rA = (bgR + (tR - bgR) * fadeA) / 255, gA = (bgG + (tG - bgG) * fadeA) / 255, bA = (bgB + (tB - bgB) * fadeA) / 255;
            const rB = (bgR + (tR - bgR) * fadeB) / 255, gB = (bgG + (tG - bgG) * fadeB) / 255, bB = (bgB + (tB - bgB) * fadeB) / 255;
            tracePosArr.set([ax, ay, zA, bx, by, zB], base);
            traceColArr.set([rA, gA, bA, rB, gB, bB], base);

            const oR = bgR / 255, oG = bgG / 255, oB = bgB / 255;
            fillPosArr.set([orx, ory, zA, ax, ay, zA, brx, bry, zB, ax, ay, zA, bx, by, zB, brx, bry, zB], fbase);
            fillColArr.set([oR, oG, oB, rA, gA, bA, oR, oG, oB, rA, gA, bA, rB, gB, bB, oR, oG, oB], fbase);
          } else {
            tracePosArr.fill(0, base, base + 6);
            traceColArr.set([bgR / 255, bgG / 255, bgB / 255, bgR / 255, bgG / 255, bgB / 255], base);
            fillPosArr.fill(0, fbase, fbase + FILL_VERTS_PER_SEG * 3);
            fillColArr.fill(bgR / 255, fbase, fbase + FILL_VERTS_PER_SEG * 3);
          }
        }
      }
      traceGeo.attributes.position.needsUpdate = true; traceGeo.attributes.color.needsUpdate = true;
      traceMat.opacity = OPACITIES.trace; traceLines.visible = showTrace;
      fillGeo.attributes.position.needsUpdate = true; fillGeo.attributes.color.needsUpdate = true;
      fillMat.opacity = OPACITIES.fill; fillMesh.visible = showTrace;

      renderer.render(scene, camera);
    }
    applyCam();
    animFrameId = requestAnimationFrame(animate);

    function handleResize() {
      const w = wrap!.clientWidth, h = wrap!.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize', handleResize);
      actionsRef.current = null;
      renderer.dispose();
      [chordGeo, dotGeo, traceGeo, fillGeo].forEach((g) => g.dispose());
      [chordMat, dotMat, traceMat, fillMat, zAxisMat].forEach((m) => m.dispose());
      [outerRing, midRing, ...ghostRings].forEach((r) => { r.geometry.dispose(); r.material.dispose(); });
    };
  }, [getValences]);

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', height: '100%', background: '#0f0f0e' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 8 }}>
        <button
          type="button"
          aria-label={`View mode: ${VIEW_LABELS[viewMode]}. Click to cycle.`}
          onClick={() => actionsRef.current?.cycleView()}
          style={buttonStyle}
        >
          view: {VIEW_LABELS[viewMode]}
        </button>
        <button
          type="button"
          aria-label={`Geometry mode: ${geoMode}. Click to cycle.`}
          onClick={() => actionsRef.current?.cycleGeometry()}
          style={buttonStyle}
        >
          geometry: {geoMode}
        </button>
      </div>
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  fontFamily: "'DM Mono', 'Courier New', monospace",
  fontSize: 10,
  letterSpacing: '.08em',
  padding: '4px 10px',
  borderRadius: 3,
  border: '.5px solid rgba(200,198,190,.18)',
  background: 'rgba(15,15,14,.7)',
  color: 'rgba(200,198,190,.75)',
  cursor: 'pointer',
};
