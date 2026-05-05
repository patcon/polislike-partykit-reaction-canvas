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
const BASELINE_Y_RATIO = 0.70;

function buildPath(points: Array<{ x: number; y: number }>, w: number, h: number): string {
  if (points.length === 0) return '';
  const px = (p: { x: number; y: number }) => `${(p.x / 100) * w},${(p.y / 100) * h}`;
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
  const [containerDims, setContainerDims] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [localStrokes, setLocalStrokes] = useState<Stroke[]>([]);
  const isDrawingRef = useRef(false);
  const currentStrokeIdRef = useRef<string | null>(null);
  const accumulatedRef = useRef<Array<{ x: number; y: number }>>([]);
  const flushIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Box geometry in pixel space (updated whenever containerDims changes).
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

  // Normalize a pointer position to 0-100 relative to the box.
  const normalize = useCallback((clientX: number, clientY: number) => {
    const rect = captureRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const { x: bX, y: bY, w: bW, h: bH } = boxRef.current;
    return {
      x: ((clientX - rect.left - bX) / bW) * 100,
      y: ((clientY - rect.top - bY) / bH) * 100,
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

  const { w: cW, h: cH } = containerDims;
  const { x: bX, y: bY, w: bW, h: bH } = boxRef.current;
  const baselineY = bY + bH * BASELINE_Y_RATIO;
  const padX = bW * 0.05;

  return (
    <div ref={outerRef} style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'rgba(18,18,18,0.88)' }}>
      <svg
        width={cW}
        height={cH}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        <defs>
          <clipPath id="sig-box-clip">
            <rect x={bX} y={bY} width={bW} height={bH} />
          </clipPath>
        </defs>

        {/* White box */}
        <rect x={bX} y={bY} width={bW} height={bH} fill="white" />
        {/* Box border */}
        <rect x={bX} y={bY} width={bW} height={bH} fill="none" stroke="#d0d0d0" strokeWidth={1.5} />

        {/* Baseline */}
        <line
          x1={bX + padX} y1={baselineY}
          x2={bX + bW - padX} y2={baselineY}
          stroke="#c0c0c0" strokeWidth={1}
        />
        {/* "Sign here" label */}
        <text
          x={bX + padX} y={baselineY + 14}
          fontSize={11} fill="#c0c0c0" fontFamily="sans-serif"
          style={{ userSelect: 'none' }}
        >
          Sign here
        </text>

        {/* Strokes — clipped to box, coordinates in box-relative space */}
        <g clipPath="url(#sig-box-clip)" transform={`translate(${bX},${bY})`}>
          {localStrokes.map(stroke => (
            <path
              key={stroke.strokeId}
              d={buildPath(stroke.points, bW, bH)}
              stroke="#1a1a1a"
              strokeWidth={1.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </g>
      </svg>

      {/* Full-surface pointer capture */}
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
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 21,
          padding: '8px 24px',
          borderRadius: 999,
          border: 'none',
          background: 'rgba(255,255,255,0.15)',
          color: '#fff',
          fontSize: 14,
          cursor: 'pointer',
          letterSpacing: '0.04em',
        }}
      >
        Clear
      </button>
    </div>
  );
}
