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

const BOX_WIDTH_RATIO = 0.88;
const ASPECT_RATIO = 16 / 9;
const BASELINE_Y = 70;
const BTN_SIZE = 30;
const BTN_GAP = 8;

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

function RotateIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

export default function SignatureLayer({ userId, onSendMessage }: SignatureLayerProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const captureRef = useRef<HTMLDivElement>(null);
  const [containerDims, setContainerDims] = useState({ w: 0, h: 0 });
  const [localStrokes, setLocalStrokes] = useState<Stroke[]>([]);
  const [rotated, setRotated] = useState(false);
  const rotatedRef = useRef(false);
  const isDrawingRef = useRef(false);
  const currentStrokeIdRef = useRef<string | null>(null);
  const accumulatedRef = useRef<Array<{ x: number; y: number }>>([]);
  const flushIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Current box geometry in CSS space — kept in ref so event handlers always read current value.
  const boxRef = useRef({ x: 0, y: 0, w: 0, h: 0 });

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const update = () => setContainerDims({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Box geometry ────────────────────────────────────────────────────────────
  const { w: cW, h: cH } = containerDims;
  const ready = cW > 0;

  // Normal (not rotated): landscape 16:9 box centred in container.
  const bWn = cW * BOX_WIDTH_RATIO;
  const bHn = bWn / ASPECT_RATIO;
  const normalBox = { x: (cW - bWn) / 2, y: (cH - bHn) / 2, w: bWn, h: bHn };

  // Rotated: sized so that after CSS rotate(90deg) the visual box fills the
  // portrait screen. Visual width = CSS height, visual height = CSS width.
  //   visual width  ≈ container width  → CSS height = cW * BOX_WIDTH_RATIO
  //   CSS width     = CSS height * 16/9 (keeps 16:9 coordinate space)
  const bHr = cW * BOX_WIDTH_RATIO;
  const bWr = bHr * ASPECT_RATIO;
  const rotatedBox = { x: (cW - bWr) / 2, y: (cH - bHr) / 2, w: bWr, h: bHr };

  const currentBox = rotated ? rotatedBox : normalBox;

  // Keep boxRef in sync so event handlers always see the current box.
  boxRef.current = currentBox;

  // ── Rotate-button position ──────────────────────────────────────────────────
  // Placed outside the wrapper so it never rotates itself.
  // Portrait frame of reference for both states:
  //   • not rotated: top-left above the landscape box
  //   • rotated:     top-right above the visual box
  //                  (after CW 90°: visual width = bHr, visual height = bWr,
  //                   both centred on the container centre)
  const rotateBtnLeft = rotated
    ? cW / 2 + bHr / 2 - BTN_SIZE
    : normalBox.x;
  const rotateBtnTop = rotated
    ? cH / 2 - bWr / 2 - BTN_SIZE - BTN_GAP
    : normalBox.y - BTN_SIZE - BTN_GAP;

  // ── Normalize ───────────────────────────────────────────────────────────────
  const normalize = useCallback((clientX: number, clientY: number) => {
    const rect = captureRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const { x: bX, y: bY, w: bW, h: bH } = boxRef.current;
    if (bW === 0 || bH === 0) return null;

    if (!rotatedRef.current) {
      return {
        x: ((clientX - rect.left - bX) / bW) * 100,
        y: ((clientY - rect.top  - bY) / bH) * 100,
      };
    }

    // Box is CSS-rotated 90° CW. Map screen coords back to box (CSS) coords.
    // After CW 90°: CSS +x axis points down screen (+relY), CSS +y axis points left (-relX).
    const cxScreen = rect.left + bX + bW / 2;
    const cyScreen = rect.top  + bY + bH / 2;
    const relX = clientX - cxScreen;
    const relY = clientY - cyScreen;
    const unrotX =  relY;   // CSS x = screen down
    const unrotY = -relX;   // CSS y = screen left
    return {
      x: ((unrotX + bW / 2) / bW) * 100,
      y: ((unrotY + bH / 2) / bH) * 100,
    };
  }, []);

  // ── Flush ───────────────────────────────────────────────────────────────────
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

  const handleRotate = useCallback(() => {
    rotatedRef.current = !rotatedRef.current;
    setRotated(rotatedRef.current);
  }, []);

  const { x: bX, y: bY, w: bW, h: bH } = currentBox;

  return (
    <div ref={outerRef} style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'rgba(160,160,160,0.72)' }}>

      {ready && (
        <>
          {/* Rotatable wrapper — box + clear button only */}
          <div style={{
            position: 'absolute',
            left: bX, top: bY, width: bW, height: bH,
            transformOrigin: 'center center',
            transform: rotated ? 'rotate(90deg)' : 'none',
            pointerEvents: 'none',
          }}>
            {/* Signature box */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'white',
              border: '1.5px solid rgba(80,80,80,0.55)',
              overflow: 'hidden',
              boxSizing: 'border-box',
            }}>
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
              >
                <line
                  x1={5} y1={BASELINE_Y} x2={95} y2={BASELINE_Y}
                  stroke="rgba(180,180,180,0.7)" strokeWidth={0.3}
                  vectorEffect="non-scaling-stroke"
                />
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

          </div>

          {/* Clear button — always at portrait bottom-centre, never rotates */}
          <button
            onClick={handleClear}
            style={{
              position: 'absolute',
              bottom: BTN_GAP * 2,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 3,
              height: BTN_SIZE,
              padding: '0 18px',
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.4)',
              background: 'rgba(255,255,255,0.18)',
              color: 'rgba(255,255,255,0.9)',
              fontSize: 13,
              cursor: 'pointer',
              letterSpacing: '0.04em',
              whiteSpace: 'nowrap',
            }}
          >
            Clear
          </button>

          {/* Rotate button — fixed outside the wrapper, repositions on rotation */}
          <button
            onClick={handleRotate}
            title="Rotate signing box"
            style={{
              position: 'absolute',
              left: rotateBtnLeft,
              top: rotateBtnTop,
              zIndex: 2,
              width: BTN_SIZE,
              height: BTN_SIZE,
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.35)',
              background: rotated ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
              transition: 'left 0.25s, top 0.25s',
            }}
          >
            <RotateIcon />
          </button>
        </>
      )}

      {/* Full-surface pointer capture */}
      <div
        ref={captureRef}
        style={{ position: 'absolute', inset: 0, touchAction: 'none', cursor: 'crosshair' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
    </div>
  );
}
