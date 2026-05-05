import { useRef, useState, useCallback } from "react";
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
  const layerRef = useRef<HTMLDivElement>(null);
  const [localStrokes, setLocalStrokes] = useState<Stroke[]>([]);
  const isDrawingRef = useRef(false);
  const currentStrokeIdRef = useRef<string | null>(null);
  const accumulatedRef = useRef<Array<{ x: number; y: number }>>([]);
  const flushIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const normalize = useCallback((clientX: number, clientY: number) => {
    const rect = layerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: ((clientX - rect.left) / rect.width) * 100, y: ((clientY - rect.top) / rect.height) * 100 };
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

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 20 }}>
      {/* SVG renders strokes behind the capture surface */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', background: 'rgba(255,255,255,0.97)' }}
      >
        {localStrokes.map(stroke => (
          <path
            key={stroke.strokeId}
            d={buildPath(stroke.points, 100, 100)}
            stroke="#1a1a1a"
            strokeWidth={0.5}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
      {/* Invisible capture div on top */}
      <div
        ref={layerRef}
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
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 21,
          padding: '8px 24px',
          borderRadius: 999,
          border: 'none',
          background: 'rgba(30,30,30,0.85)',
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
