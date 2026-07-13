import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  arcPath,
  cellPath,
  ellipsePoint,
  makeGeometry,
  radialPath,
  regionFromPoint,
  toBasis,
  type CellId,
  type Pt,
  type SectorGeometry,
} from "../../utils/annularSector";

const ANCHOR_LABELS: Record<CellId, string> = {
  disagree: "DISAGREE",
  agree: "AGREE",
  pass: "PASS",
};

const INNER_FRAC = 0.12;
const MIN_A = 20;
const MIN_B = 20;
const HALF_PI = Math.PI / 2;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const CELL_STYLE: Record<CellId, { fill: string }> = {
  disagree: { fill: "rgba(255,107,107,0.18)" },
  agree: { fill: "rgba(81,207,102,0.18)" },
  pass: { fill: "rgba(130,150,180,0.14)" },
};

const ANCHOR_COLOR: Record<CellId, string> = {
  disagree: "#ff6b6b",
  agree: "#51cf66",
  pass: "#8296b4",
};

const anchorButtonStyle = (pos: Pt, color: string): React.CSSProperties => ({
  position: "absolute",
  left: pos.x,
  top: pos.y,
  zIndex: 5,
  transform: "translate(-50%, -50%)",
  padding: "6px 12px",
  borderRadius: 999,
  border: `2px solid ${color}`,
  background: "#111",
  color: "#fff",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.04em",
  cursor: "grab",
  touchAction: "none",
  userSelect: "none",
  whiteSpace: "nowrap",
});

type DragId = "disagree" | "agree" | "pass";

interface GeoState {
  a: number;
  b: number;
  thetaDisagree: number;
  thetaAgree: number;
  thresholdFrac: number;
}

export default function ValenceCertaintyPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState<{ W: number; H: number }>({ W: 0, H: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect;
      setSize({ W: cr.width, H: cr.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { W, H } = size;

  const [gs, setGs] = useState<GeoState | null>(null);
  const prevSize = useRef<{ W: number; H: number } | null>(null);

  useEffect(() => {
    if (W === 0 || H === 0) return;
    if (!gs) {
      const a = Math.min(W, H) * 0.92;
      const b = Math.min(W, H) * 0.92;
      setGs({ a, b, thetaDisagree: 0, thetaAgree: HALF_PI, thresholdFrac: 0.5 });
    } else if (prevSize.current && (prevSize.current.W !== W || prevSize.current.H !== H)) {
      const sx = W / prevSize.current.W;
      const sy = H / prevSize.current.H;
      setGs((g) => ({ ...g!, a: g!.a * sx, b: g!.b * sy }));
    }
    prevSize.current = { W, H };
  }, [W, H, gs]);

  const apex = useMemo<Pt>(() => ({ x: W, y: H }), [W, H]);

  const geo: SectorGeometry | null = useMemo(() => {
    if (!gs) return null;
    return makeGeometry(apex, gs.a, gs.b, gs.thetaDisagree, gs.thetaAgree, gs.thresholdFrac, INNER_FRAC);
  }, [apex, gs]);

  const disagreePos = useMemo<Pt | null>(() => (geo ? ellipsePoint(geo, 1, geo.thetaDisagree) : null), [geo]);
  const agreePos = useMemo<Pt | null>(() => (geo ? ellipsePoint(geo, 1, geo.thetaAgree) : null), [geo]);
  const passPos = useMemo<Pt | null>(() => (geo ? ellipsePoint(geo, geo.thresholdFrac, geo.bisectorTheta) : null), [geo]);

  const [dragId, setDragId] = useState<DragId | null>(null);
  const [livePos, setLivePos] = useState<Pt | null>(null);
  const [debugPos, setDebugPos] = useState<Pt | null>(null);
  const [debugActive, setDebugActive] = useState(false);
  const captureElRef = useRef<Element | null>(null);

  const toLocal = useCallback((e: React.PointerEvent): Pt => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!geo) return;
    const p = toLocal(e);
    captureElRef.current = svgRef.current;
    svgRef.current?.setPointerCapture(e.pointerId);
    setLivePos(p);
    setDebugActive(true);
    setDebugPos(p);
  };

  const startDrag = (id: DragId) => (e: React.PointerEvent) => {
    e.stopPropagation();
    if (!geo) return;
    const p = toLocal(e);
    captureElRef.current = e.currentTarget;
    e.currentTarget.setPointerCapture(e.pointerId);
    setLivePos(p);
    setDragId(id);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!geo) return;
    const p = toLocal(e);
    setLivePos(p);
    if (!dragId) {
      if (debugActive) setDebugPos(p);
      return;
    }
    if (dragId === "disagree") {
      // Horizontal drag reshapes the ellipse (a); vertical drag slides the
      // handle along the arc (thetaDisagree). a is clamped to the panel width,
      // theta to [0, π/2] so the handle stays on the arc.
      const a = clamp(Math.abs(p.x - W), MIN_A, Math.max(MIN_A, W));
      const sd = clamp(Math.asin(clamp((H - p.y) / geo.b, -1, 1)), 0, HALF_PI);
      setGs((g) => ({ ...g!, a, thetaDisagree: sd }));
    } else if (dragId === "agree") {
      // Vertical drag reshapes the ellipse (b); horizontal drag slides the
      // handle along the arc (thetaAgree). b clamped to panel height.
      const b = clamp(Math.abs(p.y - H), MIN_B, Math.max(MIN_B, H));
      const sa = clamp(Math.acos(clamp((W - p.x) / geo.a, -1, 1)), 0, HALF_PI);
      setGs((g) => ({ ...g!, b, thetaAgree: sa }));
    } else if (dragId === "pass") {
      // Project the drag point onto the valence bisector in the ellipse basis;
      // its fraction along the bisector becomes the threshold.
      const { alpha, beta } = toBasis(geo, p);
      const c = Math.cos(geo.bisectorTheta);
      const s = Math.sin(geo.bisectorTheta);
      const frac = alpha * c + beta * s;
      setGs((g) => ({ ...g!, thresholdFrac: clamp(frac, 0.05, 0.95) }));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    setDragId(null);
    setDebugActive(false);
    captureElRef.current?.releasePointerCapture(e.pointerId);
    captureElRef.current = null;
  };

  if (W === 0 || H === 0 || !geo || !disagreePos || !agreePos || !passPos) {
    return <div ref={containerRef} style={{ width: "100%", flex: 1, minHeight: 0, background: "#0c0c10" }} />;
  }

  const { bisectorTheta, thresholdFrac: tf, innerFrac } = geo;
  const T0 = 0;
  const T1 = Math.PI / 2;

  const disagreeCell = cellPath(geo, tf, 1, T0, bisectorTheta);
  const agreeCell = cellPath(geo, tf, 1, bisectorTheta, T1);
  const passCellA = cellPath(geo, innerFrac, tf, T0, bisectorTheta);
  const passCellB = cellPath(geo, innerFrac, tf, bisectorTheta, T1);

  const outerArc = arcPath(geo, 1, T0, T1);
  const innerArc = arcPath(geo, innerFrac, T0, T1);
  const thresholdArc = arcPath(geo, tf, T0, T1);
  const edgeStart = radialPath(geo, T0);
  const edgeEnd = radialPath(geo, T1);
  const bisector = radialPath(geo, bisectorTheta);

  const active = livePos ?? debugPos;
  const dbg = active ? regionFromPoint(geo, active) : null;

  const renderAnchor = (id: DragId, pos: Pt) => (
    <button
      key={id}
      type="button"
      aria-label={`${ANCHOR_LABELS[id]} anchor — drag to reposition`}
      onPointerDown={startDrag(id)}
      style={anchorButtonStyle(pos, ANCHOR_COLOR[id])}
    >
      {ANCHOR_LABELS[id]}
    </button>
  );

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", flex: 1, minHeight: 0, background: "#0c0c10", position: "relative", touchAction: "none", userSelect: "none" }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <svg
        ref={svgRef}
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{ display: "block", touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerLeave={() => setLivePos(null)}
      >
        <path d={disagreeCell} fill={CELL_STYLE.disagree.fill} stroke="none" />
        <path d={agreeCell} fill={CELL_STYLE.agree.fill} stroke="none" />
        <path d={passCellA} fill={CELL_STYLE.pass.fill} stroke="none" />
        <path d={passCellB} fill={CELL_STYLE.pass.fill} stroke="none" />

        {/* Sector boundary */}
        <path d={outerArc} fill="none" stroke="#5a5a66" strokeWidth={2} />
        <path d={innerArc} fill="none" stroke="#5a5a66" strokeWidth={2} />
        <path d={edgeStart} fill="none" stroke="#5a5a66" strokeWidth={2} />
        <path d={edgeEnd} fill="none" stroke="#5a5a66" strokeWidth={2} />

        {/* Dividing lines */}
        <path d={bisector} fill="none" stroke="#e9ecef" strokeWidth={2} strokeDasharray="6 5" />
        <path d={thresholdArc} fill="none" stroke="#ffd43b" strokeWidth={3} />

        {/* Live cursor (your own finger / pointer) */}
        {livePos && (
          <g style={{ pointerEvents: "none" }}>
            <circle cx={livePos.x} cy={livePos.y} r={13} fill="rgba(77,171,247,0.35)" stroke="#4dabf7" strokeWidth={2} />
            <circle cx={livePos.x} cy={livePos.y} r={3} fill="#4dabf7" />
          </g>
        )}

        {/* Pinned debug cursor (from a tap) */}
        {debugPos && (
          <g style={{ pointerEvents: "none" }}>
            <circle cx={debugPos.x} cy={debugPos.y} r={16} fill="none" stroke="#ffd43b" strokeWidth={2} />
            <line x1={debugPos.x - 22} y1={debugPos.y} x2={debugPos.x + 22} y2={debugPos.y} stroke="#ffd43b" strokeWidth={1.5} />
            <line x1={debugPos.x} y1={debugPos.y - 22} x2={debugPos.x} y2={debugPos.y + 22} stroke="#ffd43b" strokeWidth={1.5} />
          </g>
        )}
      </svg>

      {renderAnchor("disagree", disagreePos)}
      {renderAnchor("agree", agreePos)}
      {renderAnchor("pass", passPos)}

      {/* Live readout */}
      {active && dbg && (
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            background: "rgba(0,0,0,0.6)",
            color: "#fff",
            fontFamily: "monospace",
            fontSize: 12,
            padding: "8px 10px",
            borderRadius: 6,
            lineHeight: 1.5,
          }}
        >
          <div>region: <b>{dbg.region}</b></div>
          <div>valence: {dbg.valence.toFixed(2)}</div>
          <div>certainty: {(dbg.certainty * 100).toFixed(0)}%</div>
          <div>r: {Math.hypot(active.x - W, active.y - H).toFixed(0)}px</div>
        </div>
      )}

      <div
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          color: "#888",
          fontSize: 11,
          textAlign: "right",
          maxWidth: 220,
          lineHeight: 1.4,
        }}
      >
        Annular-sector valence × certainty prototype.<br />
        Drag DISAGREE / AGREE along the outer arc to reshape &amp; reposition them; drag PASS along the divider to set the certainty threshold. Tap (not on an anchor) to pin a debug cursor.
      </div>
    </div>
  );
}
