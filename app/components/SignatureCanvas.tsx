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

export default function SignatureCanvas({ strokes, heightOffset = 0, connectedUserIds }: SignatureCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: window.innerWidth, height: window.innerHeight - heightOffset });

  useEffect(() => {
    const update = () => setDims({
      width: containerRef.current?.clientWidth ?? window.innerWidth,
      height: containerRef.current?.clientHeight ?? window.innerHeight - heightOffset,
    });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [heightOffset]);

  // Tile users = connected users + any orphan stroke keys
  const allUserIds = [...new Set([...connectedUserIds, ...Object.keys(strokes)])];
  const count = Math.max(1, allUserIds.length);
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const tileW = dims.width / cols;
  const tileH = dims.height / rows;

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0, background: '#111' }}>
      <svg width={dims.width} height={dims.height} style={{ display: 'block' }}>
        <defs>
          {allUserIds.map(uid => (
            <clipPath key={`clip-${uid}`} id={`sig-clip-${uid}`}>
              <rect x={0} y={0} width={tileW} height={tileH} />
            </clipPath>
          ))}
        </defs>
        {allUserIds.map((uid, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const userStrokes = strokes[uid] ?? [];
          return (
            <g key={uid} transform={`translate(${col * tileW},${row * tileH})`}>
              <rect width={tileW} height={tileH} fill="white" stroke="#333" strokeWidth={1} />
              <g clipPath={`url(#sig-clip-${uid})`}>
                {userStrokes.map(stroke => (
                  <path
                    key={stroke.strokeId}
                    d={buildPath(stroke.points, tileW, tileH)}
                    stroke="#1a1a1a"
                    strokeWidth={2.5}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </g>
              <text x={6} y={tileH - 6} fontSize={10} fill="#999" fontFamily="monospace">
                {uid.slice(0, 8)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
