import { useEffect, useRef } from 'react';
import { usePanelContext } from '../../app/context/PanelContext';
import { useCoordStream } from '../../app/hooks/useCoordStream';

interface Vec { x: number; y: number }
interface Boid { x: number; y: number; vx: number; vy: number }

const TUNING = {
  humanAttraction: 0.12,
  personalSpace: 0,
  separation: 0.06,
  alignment: 0.05,
  cohesion: 0.008,
  maxSpeed: 0.8,
  boidCount: 200,
};

export default function BoidsPanel() {
  const { userId } = usePanelContext();
  const { positionsRef } = useCoordStream(userId);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boidsRef = useRef<Boid[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    // Seed boids once.
    let bseed = 12345;
    const rnd = () => { bseed = (bseed * 1103515245 + 12345) & 0x7fffffff; return bseed / 0x7fffffff; };
    const boids = boidsRef.current;
    while (boids.length < TUNING.boidCount) {
      boids.push({ x: rnd() * 100, y: rnd() * 100, vx: 0, vy: 0 });
    }

    let raf = 0;
    const step = () => {
      const humans = positionsRef.current;
      const humanList = [...humans.values()];

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;

      const { humanAttraction, personalSpace, separation, alignment, cohesion, maxSpeed } = TUNING;
      const SEP = 4, ALIGN_R = 8, COH_R = 10;

      for (const b of boids) {
        let sepX = 0, sepY = 0;
        let aliX = 0, aliY = 0, aliN = 0;
        let cohX = 0, cohY = 0, cohN = 0;
        let localDensity = 0;

        for (const o of boids) {
          if (o === b) continue;
          const dx = b.x - o.x, dy = b.y - o.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < SEP * SEP) { sepX += dx; sepY += dy; localDensity++; }
          if (d2 < ALIGN_R * ALIGN_R) { aliX += o.vx; aliY += o.vy; aliN++; }
          if (d2 < COH_R * COH_R) { cohX += o.x; cohY += o.y; cohN++; }
        }
        const vs = localDensity > 6 ? 0.5 : 1;
        if (aliN) { aliX = aliX / aliN - b.vx; aliY = aliY / aliN - b.vy; }
        if (cohN) { cohX = cohX / cohN - b.x; cohY = cohY / cohN - b.y; }

        // Steer toward nearest human.
        let arrX = 0, arrY = 0;
        if (humanList.length) {
          let best = Infinity;
          let target: Vec | undefined;
          for (const hp of humanList) {
            const dx = hp.x - b.x, dy = hp.y - b.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < best) { best = d2; target = hp; }
          }
          if (target) {
            const dx = target.x - b.x, dy = target.y - b.y;
            const dist = Math.hypot(dx, dy) || 1;
            const gap = dist - personalSpace;
            const desired = Math.max(Math.min(gap / 6, maxSpeed), gap < 0 ? -maxSpeed : 0);
            arrX = (dx / dist) * desired - b.vx;
            arrY = (dy / dist) * desired - b.vy;
          }
        }

        b.vx += sepX * separation + aliX * alignment * vs + cohX * cohesion * vs + arrX * humanAttraction;
        b.vy += sepY * separation + aliY * alignment * vs + cohY * cohesion * vs + arrY * humanAttraction;

        const sp = Math.hypot(b.vx, b.vy);
        if (sp > maxSpeed) { b.vx = b.vx / sp * maxSpeed; b.vy = b.vy / sp * maxSpeed; }
        b.x = Math.max(0, Math.min(100, b.x + b.vx));
        b.y = Math.max(0, Math.min(100, b.y + b.vy));
      }

      ctx.clearRect(0, 0, w, h);
      const sx = w / 100, sy = h / 100;

      ctx.fillStyle = '#e8e8e8';
      for (const b of boids) {
        const ang = Math.atan2(b.vy, b.vx);
        const px = b.x * sx, py = b.y * sy;
        ctx.beginPath();
        ctx.moveTo(px + Math.cos(ang) * 6, py + Math.sin(ang) * 6);
        ctx.lineTo(px + Math.cos(ang + 2.5) * 4, py + Math.sin(ang + 2.5) * 4);
        ctx.lineTo(px + Math.cos(ang - 2.5) * 4, py + Math.sin(ang - 2.5) * 4);
        ctx.closePath();
        ctx.fill();
      }

      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [positionsRef]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#111' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
}
