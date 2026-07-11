import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  arcPath,
  cellPath,
  makeGeometryFromAnchors,
  outerRadiusAt,
  pointAtRadius,
  radialPath,
  regionFromPoint,
  type CellId,
  type Pt,
  type SectorGeometry,
} from "../../utils/annularSector";

const ANCHOR_LABELS: Record<CellId, string> = {
  disagree: "DISAGREE",
  agree: "AGREE",
  pass: "PASS",
};

const ANCHOR_HIT_RADIUS = 30;
const INNER_FRAC = 0.12;

const CELL_STYLE: Record<CellId, { fill: string }> = {
  disagree: { fill: "rgba(255,107,107,0.18)" },
  agree: { fill: "rgba(81,207,102,0.18)" },
  pass: { fill: "rgba(130,150,180,0.14)" },
};

type DragId = "disagree" | "agree" | "pass";

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

  const [anchors, setAnchors] = useState<{ disagree: Pt; agree: Pt } | null>(null);
  const [thresholdFrac, setThresholdFrac] = useState(0.5);
  const prevSize = useRef<{ W: number; H: number } | null>(null);

  useEffect(() => {
    if (W === 0 || H === 0) return;
    const rOut = Math.min(W, H) * 0.92;
    if (!anchors) {
      setAnchors({ disagree: { x: W - rOut, y: H }, agree: { x: W, y: H - rOut } });
    } else if (prevSize.current && (prevSize.current.W !== W || prevSize.current.H !== H)) {
      const sx = W / prevSize.current.W;
      const sy = H / prevSize.current.H;
      setAnchors((a) => ({
        disagree: { x: a!.disagree.x * sx, y: a!.disagree.y * sy },
        agree: { x: a!.agree.x * sx, y: a!.agree.y * sy },
      }));
    }
    prevSize.current = { W, H };
  }, [W, H, anchors]);

  const apex = useMemo<Pt>(() => ({ x: W, y: H }), [W, H]);

  const geo: SectorGeometry | null = useMemo(() => {
    if (!anchors) return null;
    // The bisector (and thus the pass anchor position) depends only on the
    // disagree/agree anchors, not on the pass anchor itself. Build a provisional
    // geometry to find the bisector, then place pass at thresholdFrac along it.
    const provisional = makeGeometryFromAnchors(apex, anchors.disagree, anchors.agree, apex, INNER_FRAC);
    const rOutBis = outerRadiusAt(provisional, provisional.bisectorPhi);
    const pass = pointAtRadius(provisional, thresholdFrac * rOutBis, provisional.bisectorPhi);
    return makeGeometryFromAnchors(apex, anchors.disagree, anchors.agree, pass, INNER_FRAC);
  }, [apex, anchors, thresholdFrac]);

  const passPixel = useMemo<Pt | null>(() => {
    if (!geo) return null;
    const rOutBis = outerRadiusAt(geo, geo.bisectorPhi);
    return pointAtRadius(geo, thresholdFrac * rOutBis, geo.bisectorPhi);
  }, [geo, thresholdFrac]);

  const [dragId, setDragId] = useState<DragId | null>(null);
  const [livePos, setLivePos] = useState<Pt | null>(null);
  const [debugPos, setDebugPos] = useState<Pt | null>(null);
  const [debugActive, setDebugActive] = useState(false);

  const toLocal = useCallback((e: React.PointerEvent): Pt => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!anchors || !passPixel || !geo) return;
    const p = toLocal(e);
    const candidates: { id: DragId; pos: Pt }[] = [
      { id: "disagree", pos: anchors.disagree },
      { id: "agree", pos: anchors.agree },
      { id: "pass", pos: passPixel },
    ];
    let nearest: DragId | null = null;
    let best = ANCHOR_HIT_RADIUS;
    for (const c of candidates) {
      const d = Math.hypot(c.pos.x - p.x, c.pos.y - p.y);
      if (d < best) {
        best = d;
        nearest = c.id;
      }
    }
    svgRef.current?.setPointerCapture(e.pointerId);
    setLivePos(p);
    if (nearest) {
      setDragId(nearest);
    } else {
      setDebugActive(true);
      setDebugPos(p);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!anchors || !geo) return;
    const p = toLocal(e);
    setLivePos(p);
    if (!dragId) {
      if (debugActive) setDebugPos(p);
      return;
    }
    if (dragId === "disagree") {
      setAnchors((a) => ({ ...a!, disagree: p }));
    } else if (dragId === "agree") {
      setAnchors((a) => ({ ...a!, agree: p }));
    } else if (dragId === "pass") {
      const vx = p.x - apex.x;
      const vy = p.y - apex.y;
      const dir = { x: Math.cos(geo.bisectorPhi), y: Math.sin(geo.bisectorPhi) };
      const proj = vx * dir.x + vy * dir.y;
      const rOutBis = outerRadiusAt(geo, geo.bisectorPhi);
      setThresholdFrac(Math.max(0.05, Math.min(0.95, proj / rOutBis)));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    setDragId(null);
    setDebugActive(false);
    svgRef.current?.releasePointerCapture(e.pointerId);
  };

  if (W === 0 || H === 0 || !anchors || !geo || !passPixel) {
    return <div ref={containerRef} style={{ width: "100%", flex: 1, minHeight: 0, background: "#0c0c10" }} />;
  }

  const { phiStart, phiEnd, bisectorPhi, thresholdFrac: tf, innerFrac } = geo;

  const disagreeCell = cellPath(geo, tf, 1, phiStart, bisectorPhi);
  const agreeCell = cellPath(geo, tf, 1, bisectorPhi, phiEnd);
  const passCellA = cellPath(geo, innerFrac, tf, phiStart, bisectorPhi);
  const passCellB = cellPath(geo, innerFrac, tf, bisectorPhi, phiEnd);

  const outerArc = arcPath(geo, 1, phiStart, phiEnd);
  const innerArc = arcPath(geo, innerFrac, phiStart, phiEnd);
  const thresholdArc = arcPath(geo, tf, phiStart, phiEnd);
  const edgeStart = radialPath(geo, phiStart);
  const edgeEnd = radialPath(geo, phiEnd);
  const bisector = radialPath(geo, bisectorPhi);

  const active = livePos ?? debugPos;
  const dbg = active ? regionFromPoint(geo, active) : null;

  const renderAnchor = (id: DragId, pos: Pt) => (
    <g key={id}>
      <circle cx={pos.x} cy={pos.y} r={11} fill="#fff" stroke="#111" strokeWidth={2} style={{ cursor: "grab" }} />
      <circle cx={pos.x} cy={pos.y} r={4} fill="#111" />
      <text x={pos.x} y={pos.y - 18} textAnchor="middle" fontSize={13} fontWeight={700} fill="#fff" style={{ pointerEvents: "none" }}>
        {ANCHOR_LABELS[id]}
      </text>
    </g>
  );

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", flex: 1, minHeight: 0, background: "#0c0c10", position: "relative", touchAction: "none", userSelect: "none" }}
    >
      <svg
        ref={svgRef}
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{ display: "block", touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
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

        {renderAnchor("disagree", anchors.disagree)}
        {renderAnchor("agree", anchors.agree)}
        {renderAnchor("pass", passPixel)}

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
        Drag DISAGREE / AGREE to reshape the sector (ellipsoid). Drag PASS along the divider to set the certainty threshold. Tap (not on an anchor) to pin a debug cursor.
      </div>
    </div>
  );
}
