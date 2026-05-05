import { useRef, useState, useEffect } from "react";

interface Stroke {
  strokeId: string;
  points: Array<{ x: number; y: number }>;
}

interface SignatureCanvasProps {
  userId: string;
  strokes: Record<string, Stroke[]>;
  heightOffset?: number;
  connectedUserIds: string[];
}

// Must match the aspect ratio used in SignatureLayer.
const SIG_ASPECT = 16 / 9;

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

// Largest 16:9 rect that fits inside (tileW × tileH), centered.
function fitSig(tileW: number, tileH: number) {
  let sigW = tileW;
  let sigH = tileW / SIG_ASPECT;
  if (sigH > tileH) {
    sigH = tileH;
    sigW = tileH * SIG_ASPECT;
  }
  return {
    sigW,
    sigH,
    offsetX: (tileW - sigW) / 2,
    offsetY: (tileH - sigH) / 2,
  };
}

export default function SignatureCanvas({ strokes, heightOffset = 0, connectedUserIds }: SignatureCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: window.innerWidth, height: window.innerHeight - heightOffset });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setDims({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const allUserIds = [...new Set([...connectedUserIds, ...Object.keys(strokes)])];
  const count = Math.max(1, allUserIds.length);
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const tileW = dims.width / cols;
  const tileH = dims.height / rows;
  const { sigW, sigH, offsetX, offsetY } = fitSig(tileW, tileH);

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0, background: '#222' }}>
      <svg width={dims.width} height={dims.height} style={{ display: 'block' }}>
        <defs>
          {allUserIds.map(uid => (
            <clipPath key={`clip-${uid}`} id={`sig-clip-${uid}`}>
              <rect x={offsetX} y={offsetY} width={sigW} height={sigH} />
            </clipPath>
          ))}
        </defs>
        {allUserIds.map((uid, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const userStrokes = strokes[uid] ?? [];
          return (
            <g key={uid} transform={`translate(${col * tileW},${row * tileH})`}>
              {/* Tile background */}
              <rect width={tileW} height={tileH} fill="#2a2a2a" />
              {/* Signature box — correct aspect ratio, centered in tile */}
              <rect x={offsetX} y={offsetY} width={sigW} height={sigH} fill="white" stroke="rgba(80,80,80,0.55)" strokeWidth={1} />
              {/* Strokes clipped to signature box */}
              <g clipPath={`url(#sig-clip-${uid})`} transform={`translate(${offsetX},${offsetY})`}>
                {userStrokes.map(stroke => (
                  <path
                    key={stroke.strokeId}
                    d={buildPath(stroke.points, sigW, sigH)}
                    stroke="#1a1a1a"
                    strokeWidth={1.5}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </g>
              {/* User label */}
              <text x={offsetX + 5} y={offsetY + sigH - 5} fontSize={10} fill="#999" fontFamily="monospace">
                {uid.slice(0, 8)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
