import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  arcPath,
  cellPath,
  defaultAnchors,
  makeGeometry,
  pointAt,
  regionFromPoint,
  HALF_PI,
  PHI_MID,
  type CellId,
  type Pt,
  type SectorGeometry,
} from "../../utils/annularSector";

const ANCHOR_LABELS: Record<CellId, string> = {
  disagree: "DISAGREE",
  agree: "AGREE",
  pass1: "PASS",
  pass2: "PASS",
};

const ANCHOR_HIT_RADIUS = 30;

const CELL_STYLE: Record<CellId, { fill: string }> = {
  disagree: { fill: "rgba(255,107,107,0.18)" },
  agree: { fill: "rgba(81,207,102,0.18)" },
  pass1: { fill: "rgba(130,150,180,0.14)" },
  pass2: { fill: "rgba(130,150,180,0.14)" },
};

const ANCHOR_IDS: CellId[] = ["disagree", "agree", "pass1", "pass2"];

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

  const geo: SectorGeometry = useMemo(() => makeGeometry(W, H), [W, H]);

  const [anchors, setAnchors] = useState<Record<CellId, Pt> | null>(null);
  const prevSize = useRef<{ W: number; H: number } | null>(null);

  useEffect(() => {
    if (W === 0 || H === 0) return;
    if (!anchors) {
      setAnchors(defaultAnchors(geo));
    } else if (prevSize.current && (prevSize.current.W !== W || prevSize.current.H !== H)) {
      const sx = W / prevSize.current.W;
      const sy = H / prevSize.current.H;
      setAnchors((a) => ({
        disagree: { x: a!.disagree.x * sx, y: a!.disagree.y * sy },
        agree: { x: a!.agree.x * sx, y: a!.agree.y * sy },
        pass1: { x: a!.pass1.x * sx, y: a!.pass1.y * sy },
        pass2: { x: a!.pass2.x * sx, y: a!.pass2.y * sy },
      }));
    }
    prevSize.current = { W, H };
  }, [W, H, anchors, geo]);

  const [dragId, setDragId] = useState<CellId | null>(null);
  const [livePos, setLivePos] = useState<Pt | null>(null);
  const [debugPos, setDebugPos] = useState<Pt | null>(null);
  const [debugActive, setDebugActive] = useState(false);

  const toLocal = useCallback((e: React.PointerEvent): Pt => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!anchors) return;
    const p = toLocal(e);
    let nearest: CellId | null = null;
    let best = ANCHOR_HIT_RADIUS;
    for (const id of ANCHOR_IDS) {
      const d = Math.hypot(anchors[id].x - p.x, anchors[id].y - p.y);
      if (d < best) {
        best = d;
        nearest = id;
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
    if (!anchors) return;
    const p = toLocal(e);
    setLivePos(p);
    if (dragId) {
      setAnchors((a) => ({ ...a!, [dragId]: p }));
    } else if (debugActive) {
      setDebugPos(p);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    setDragId(null);
    setDebugActive(false);
    svgRef.current?.releasePointerCapture(e.pointerId);
  };

  if (W === 0 || H === 0 || !anchors) {
    return <div ref={containerRef} style={{ width: "100%", flex: 1, minHeight: 0, background: "#0c0c10" }} />;
  }

  const { r0, r1, rm, threshold } = geo;

  const disagreeCell = { id: "disagree" as CellId, path: cellPath(geo, rm, r1, 0, PHI_MID) };
  const agreeCell = { id: "agree" as CellId, path: cellPath(geo, rm, r1, PHI_MID, HALF_PI) };
  const passCellA = { id: "pass1" as CellId, path: cellPath(geo, r0, rm, 0, PHI_MID) };
  const passCellB = { id: "pass2" as CellId, path: cellPath(geo, r0, rm, PHI_MID, HALF_PI) };
  const cells = [disagreeCell, agreeCell, passCellA, passCellB];

  const radialLine = `M ${pointAt(geo, r0, PHI_MID).x} ${pointAt(geo, r0, PHI_MID).y} L ${pointAt(geo, r1, PHI_MID).x} ${pointAt(geo, r1, PHI_MID).y}`;
  const outerArc = arcPath(geo, r1, 0, HALF_PI);
  const innerArc = arcPath(geo, r0, 0, HALF_PI);
  const thresholdArc = arcPath(geo, rm, 0, HALF_PI);
  const edgeA = `M ${pointAt(geo, r0, 0).x} ${pointAt(geo, r0, 0).y} L ${pointAt(geo, r1, 0).x} ${pointAt(geo, r1, 0).y}`;
  const edgeB = `M ${pointAt(geo, r0, HALF_PI).x} ${pointAt(geo, r0, HALF_PI).y} L ${pointAt(geo, r1, HALF_PI).x} ${pointAt(geo, r1, HALF_PI).y}`;

  const active = livePos ?? debugPos;
  const dbg = active ? regionFromPoint(geo, active) : null;

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
        {cells.map((c) => (
          <path key={c.id} d={c.path} fill={CELL_STYLE[c.id].fill} stroke="none" />
        ))}

        {/* Sector boundary */}
        <path d={outerArc} fill="none" stroke="#5a5a66" strokeWidth={2} />
        <path d={innerArc} fill="none" stroke="#5a5a66" strokeWidth={2} />
        <path d={edgeA} fill="none" stroke="#5a5a66" strokeWidth={2} />
        <path d={edgeB} fill="none" stroke="#5a5a66" strokeWidth={2} />

        {/* Dividing lines */}
        <path d={radialLine} fill="none" stroke="#e9ecef" strokeWidth={2} strokeDasharray="6 5" />
        <path d={thresholdArc} fill="none" stroke="#ffd43b" strokeWidth={3} />

        {/* Anchors */}
        {ANCHOR_IDS.map((id) => {
          const a = anchors[id];
          return (
            <g key={id}>
              <circle cx={a.x} cy={a.y} r={11} fill="#fff" stroke="#111" strokeWidth={2} style={{ cursor: "grab" }} />
              <circle cx={a.x} cy={a.y} r={4} fill="#111" />
              <text x={a.x} y={a.y - 18} textAnchor="middle" fontSize={13} fontWeight={700} fill="#fff" style={{ pointerEvents: "none" }}>
                {ANCHOR_LABELS[id]}
              </text>
            </g>
          );
        })}

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
        Move your finger/cursor to read the region live. Drag anchors to reposition. Tap (not on an anchor) to pin a debug cursor.
      </div>
    </div>
  );
}
