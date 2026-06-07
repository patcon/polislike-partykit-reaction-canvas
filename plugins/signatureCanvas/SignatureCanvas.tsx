import { useRef, useState, useEffect } from "react";

interface Stroke {
  strokeId: string;
  points: Array<{ x: number; y: number }>;
}

interface SignatureCanvasProps {
  userId: string;
  strokes: Record<string, Stroke[]>;
  heightOffset?: number;
}

// Must match SignatureLayer.
const SIG_ASPECT = 16 / 9;

// Raw 0–100 viewBox coordinates — same as SignatureLayer uses.
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

// Largest 16:9 rect that fits inside (tileW × tileH), centered.
function fitSig(tileW: number, tileH: number) {
  let sigW = tileW;
  let sigH = tileW / SIG_ASPECT;
  if (sigH > tileH) {
    sigH = tileH;
    sigW = tileH * SIG_ASPECT;
  }
  return { sigW, sigH, offsetX: (tileW - sigW) / 2, offsetY: (tileH - sigH) / 2 };
}

export default function SignatureCanvas({ strokes }: SignatureCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setDims({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const signerIds = Object.keys(strokes).filter(uid => strokes[uid].some(s => s.points.length > 0));
  const count = Math.max(1, signerIds.length);
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const tileW = dims.width / cols;
  const tileH = dims.height / rows;
  const { sigW, sigH, offsetX, offsetY } = fitSig(tileW, tileH);

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0, background: '#222' }}>
      <svg width={dims.width} height={dims.height} style={{ display: 'block' }}>
        {signerIds.map((uid, i) => {
          const tileX = (i % cols) * tileW;
          const tileY = Math.floor(i / cols) * tileH;
          const sigX = tileX + offsetX;
          const sigY = tileY + offsetY;
          const userStrokes = strokes[uid] ?? [];
          return (
            <g key={uid}>
              <rect x={tileX} y={tileY} width={tileW} height={tileH} fill="#2a2a2a" />
              {/* White sig box */}
              <rect x={sigX} y={sigY} width={sigW} height={sigH} fill="white" stroke="rgba(80,80,80,0.55)" strokeWidth={1} />
              {/* Nested SVG — same viewBox as SignatureLayer, clips naturally at its viewport */}
              <svg x={sigX} y={sigY} width={sigW} height={sigH} viewBox="0 0 100 100" preserveAspectRatio="none" overflow="hidden">
                {userStrokes.map(stroke => (
                  <path
                    key={stroke.strokeId}
                    d={buildPath(stroke.points)}
                    stroke="#1a1a1a"
                    strokeWidth={1.5}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </svg>
              {/* User label */}
              <text x={sigX + 4} y={sigY + sigH - 4} fontSize={10} fill="#999" fontFamily="monospace">
                {uid.slice(0, 8)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
