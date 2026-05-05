import { useRef, useState, useCallback, useEffect } from "react";
import { generateUUID } from "../utils/userId";

interface Stroke {
  strokeId: string;
  points: Array<{ x: number; y: number }>;
}

interface SignatureLayerProps {
  userId: string;
  onSendMessage: (msg: string) => void;
  heightOffset?: number;
}

// Box proportions: landscape mobile (~16:9), centered, 88% of container width.
const BOX_WIDTH_RATIO = 0.88;
const ASPECT_RATIO = 16 / 9;
// Signature baseline sits at 70% down inside the box.
const BASELINE_Y = 70; // in viewBox units (0-100)

function buildPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  const px = (p: { x: number; y: number }) => `${p.x},${p.y}`;
  if (points.length === 1) return `M ${px(points[0])} L ${px(points[0])}`;
  let d = `M ${px(points[0])}`;
  for (let i = 1; i < points.length - 1; i++) {
    const mid = { x: (points[i].x + points[i + 1].x) / 2, y: (points[i].y + points[i + 1].y) / 2 };
    d += ` Q ${px(points[i])} ${px(mid)}`;
  }
  return d + ` L ${px(points[points.length - 1])}`;
}

export default function SignatureLayer({ userId, onSendMessage }: SignatureLayerProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const captureRef = useRef<HTMLDivElement>(null);
  const [containerDims, setContainerDims] = useState({ w: 0, h: 0 });
  const [localStrokes, setLocalStrokes] = useState<Stroke[]>([]);
  const isDrawingRef = useRef(false);
  const currentStrokeIdRef = useRef<string | null>(null);
  const accumulatedRef = useRef<Array<{ x: number; y: number }>>([]);
  const flushIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Box pixel geometry — kept in a ref so event handlers always read current values.
  const boxRef = useRef({ x: 0, y: 0, w: 0, h: 0 });

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const update = () => {
      const cW = el.clientWidth;
      const cH = el.clientHeight;
      const bW = cW * BOX_WIDTH_RATIO;
      const bH = bW / ASPECT_RATIO;
      boxRef.current = { x: (cW - bW) / 2, y: (cH - bH) / 2, w: bW, h: bH };
      setContainerDims({ w: cW, h: cH });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Normalize a pointer to 0–100 coordinates relative to the box.
  const normalize = useCallback((clientX: number, clientY: number) => {
    const rect = captureRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const { x: bX, y: bY, w: bW, h: bH } = boxRef.current;
    if (bW === 0 || bH === 0) return null;
    return {
      x: ((clientX - rect.left - bX) / bW) * 100,
      y: ((clientY - rect.top  - bY) / bH) * 100,
    };
  }, []);

  const flush = useCallback((isFinal: boolean) => {
    const pts = accumulatedRef.current.splice(0);
    if (pts.length === 0 && !isFinal) return;
    const strokeId = currentStrokeIdRef.current;
    if (!strokeId) return;
    onSendMessage(JSON.stringify({ type: 'strokeSegment', userId, strokeId, points: pts, isFinal }));
  }, [userId, onSendMessage]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const pt = normalize(e.clientX, e.clientY);
    if (!pt) return;
    const strokeId = generateUUID();
    currentStrokeIdRef.current = strokeId;
    isDrawingRef.current = true;
    accumulatedRef.current = [pt];
    setLocalStrokes(prev => [...prev, { strokeId, points: [pt] }]);
    flushIntervalRef.current = setInterval(() => flush(false), 50);
    (e.target as Element).setPointerCapture(e.pointerId);
  }, [normalize, flush]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDrawingRef.current) return;
    const pt = normalize(e.clientX, e.clientY);
    if (!pt) return;
    accumulatedRef.current.push(pt);
    setLocalStrokes(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      return [...prev.slice(0, -1), { ...last, points: [...last.points, pt] }];
    });
  }, [normalize]);

  const handlePointerUp = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    if (flushIntervalRef.current) clearInterval(flushIntervalRef.current);
    flush(true);
    currentStrokeIdRef.current = null;
  }, [flush]);

  const handleClear = useCallback(() => {
    setLocalStrokes([]);
    onSendMessage(JSON.stringify({ type: 'clearSignature', userId }));
  }, [userId, onSendMessage]);

  const { x: bX, y: bY, w: bW, h: bH } = boxRef.current;
  const ready = containerDims.w > 0;

  return (
    <div ref={outerRef} style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'rgba(160,160,160,0.72)' }}>

      {/* Signature box: overflow:hidden is the hard clip */}
      {ready && (
        <div style={{
          position: 'absolute',
          left: bX, top: bY, width: bW, height: bH,
          background: 'white',
          border: '1.5px solid rgba(80,80,80,0.55)',
          overflow: 'hidden',
          pointerEvents: 'none',
          boxSizing: 'border-box',
        }}>
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          >
            {/* Faint guide line (baseline) */}
            <line
              x1={5} y1={BASELINE_Y} x2={95} y2={BASELINE_Y}
              stroke="rgba(180,180,180,0.7)" strokeWidth={0.3}
              vectorEffect="non-scaling-stroke"
            />
            {/* Strokes */}
            {localStrokes.map(stroke => (
              <path
                key={stroke.strokeId}
                d={buildPath(stroke.points)}
                stroke="#1a1a1a"
                strokeWidth={1}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
          {/* "Sign here" label pinned just below the baseline */}
          <div style={{
            position: 'absolute',
            left: '5%',
            top: `${BASELINE_Y + 1}%`,
            fontSize: 10,
            color: 'rgba(160,160,160,0.8)',
            pointerEvents: 'none',
            userSelect: 'none',
            fontFamily: 'sans-serif',
          }}>
            Sign here
          </div>
        </div>
      )}

      {/* Full-surface pointer capture (sits on top of the box div) */}
      <div
        ref={captureRef}
        style={{ position: 'absolute', inset: 0, touchAction: 'none', cursor: 'crosshair' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />

      <button
        onClick={handleClear}
        style={{
          position: 'absolute',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 21,
          padding: '7px 22px',
          borderRadius: 999,
          border: '1px solid rgba(255,255,255,0.4)',
          background: 'rgba(255,255,255,0.18)',
          color: 'rgba(255,255,255,0.9)',
          fontSize: 13,
          cursor: 'pointer',
          letterSpacing: '0.04em',
        }}
      >
        Clear
      </button>
    </div>
  );
}
