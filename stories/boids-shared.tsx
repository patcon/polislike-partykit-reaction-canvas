// Shared types and components used by both BoidsSpike.stories.tsx and
// BoidsSpikeLive.stories.tsx. Not a story file itself.
import React, { useEffect, useRef, useState } from 'react';

export type Vec = { x: number; y: number };

export interface CoordStream {
  /** Per-frame readable. Safe to read in a RAF loop without triggering re-renders. */
  positionsRef: React.MutableRefObject<Map<string, Vec>>;
  /** Present only on live connections; undefined for mock streams. */
  status?: string;
}

export type PairingMode = 'dynamic' | 'strict';

export interface BoidTuning {
  /** Pull toward the human target. Low = aloof, high = clingy. */
  humanAttraction: number;
  /** Ring radius (0..100) boids try to keep from their human. High = keep distance. */
  personalSpace: number;
  separation: number;
  alignment: number;
  cohesion: number;
  maxSpeed: number;
}

interface Boid { x: number; y: number; vx: number; vy: number; human?: string }

const STATUS_COLOR: Record<string, string> = {
  connected: '#9f9', connecting: '#ff9', disconnected: '#f99', error: '#f66',
};

export function BoidsCanvas({
  stream,
  boidCount,
  isBoidCountPerHuman,
  mode,
  showHumans,
  tuning,
}: {
  stream: CoordStream;
  /**
   * Swarm size. A fixed total by default; when `isBoidCountPerHuman` is set,
   * it's instead the number of boids per live human cursor.
   */
  boidCount: number;
  /**
   * Reinterpret `boidCount` as boids-per-human: the swarm is sized each frame
   * to `boidCount × liveHumanCount`, growing as humans join and dissolving as
   * they leave. Works for both mock and live streams.
   */
  isBoidCountPerHuman?: boolean;
  mode: PairingMode;
  showHumans: boolean;
  tuning: BoidTuning;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boidsRef = useRef<Boid[]>([]);
  // Read tuning live from a ref so slider drags apply without restarting the sim.
  const tuningRef = useRef(tuning);
  tuningRef.current = tuning;
  // Assumption #2 probe: count React renders of THIS component.
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;
  const [humanCount, setHumanCount] = useState(0);
  // Live swarm size for the badge (varies per-frame in per-human mode).
  const [swarmSize, setSwarmSize] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const boids = boidsRef.current;
    // Persistent PRNG so boids spawned mid-run (per-human growth) keep getting
    // fresh scatter positions rather than repeating the seed each frame.
    let bseed = 12345;
    const rnd = () => { bseed = (bseed * 1103515245 + 12345) & 0x7fffffff; return bseed / 0x7fffffff; };
    // Resize the swarm to `target`, spawning/trimming as needed.
    const resize = (target: number) => {
      while (boids.length < target) {
        const i = boids.length;
        boids.push({ x: rnd() * 100, y: rnd() * 100, vx: 0, vy: 0, human: `h${i}` });
      }
      if (boids.length > target) boids.length = target;
    };
    // Seed fixed-count mode up front; per-human mode sizes inside the loop.
    if (!isBoidCountPerHuman) resize(boidCount);

    let raf = 0;
    let lastBadge = 0;

    const step = (t: number) => {
      const tuning = tuningRef.current; // live-tunable, no sim restart
      // READ THE STREAM — the whole point. ref.current, no React involved.
      const humans = stream.positionsRef.current;
      const humanList = [...humans.entries()];

      // Per-human mode: swarm tracks live participation.
      if (isBoidCountPerHuman) resize(Math.max(1, humanList.length) * boidCount);

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;

      // --- boids update ---
      const SEP = 4, ALIGN_R = 8, COH_R = 10;
      for (const b of boids) {
        let sepX = 0, sepY = 0;
        let aliX = 0, aliY = 0, aliN = 0;
        let cohX = 0, cohY = 0, cohN = 0;

        // Adaptive vision: shrink neighbour radius in dense areas.
        let localDensity = 0;
        for (const o of boids) {
          if (o === b) continue;
          const dx = b.x - o.x, dy = b.y - o.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < SEP * SEP) { sepX += dx; sepY += dy; localDensity++; }
          if (d2 < ALIGN_R * ALIGN_R) { aliX += o.vx; aliY += o.vy; aliN++; }
          if (d2 < COH_R * COH_R) { cohX += o.x; cohY += o.y; cohN++; }
        }
        const visionScale = localDensity > 6 ? 0.5 : 1; // jitter guard in clusters
        if (aliN) { aliX = aliX / aliN - b.vx; aliY = aliY / aliN - b.vy; }
        if (cohN) { cohX = cohX / cohN - b.x; cohY = cohY / cohN - b.y; }

        // Steer toward a human target.
        let target: Vec | undefined;
        if (mode === 'strict') {
          target = (b.human && humans.get(b.human)) || undefined;
          // If assigned human left, fall back to nearest (graceful churn).
        }
        if (!target && humanList.length) {
          let best = Infinity;
          for (const [, hp] of humanList) {
            const dx = hp.x - b.x, dy = hp.y - b.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < best) { best = d2; target = hp; }
          }
        }

        let arrX = 0, arrY = 0;
        if (target) {
          const dx = target.x - b.x, dy = target.y - b.y;
          const dist = Math.hypot(dx, dy) || 1;
          // "Arrive" toward a RING at `personalSpace` from the human, with
          // inverse-distance damping. Larger personalSpace => boids orbit
          // rather than pile onto the human (less clingy).
          const gap = dist - tuning.personalSpace;
          const desired = Math.max(Math.min(gap / 6, tuning.maxSpeed), gap < 0 ? -tuning.maxSpeed : 0);
          arrX = (dx / dist) * desired - b.vx;
          arrY = (dy / dist) * desired - b.vy;
        }

        b.vx += (sepX * tuning.separation + aliX * tuning.alignment * visionScale + cohX * tuning.cohesion * visionScale + arrX * tuning.humanAttraction);
        b.vy += (sepY * tuning.separation + aliY * tuning.alignment * visionScale + cohY * tuning.cohesion * visionScale + arrY * tuning.humanAttraction);

        const sp = Math.hypot(b.vx, b.vy);
        if (sp > tuning.maxSpeed) { b.vx = (b.vx / sp) * tuning.maxSpeed; b.vy = (b.vy / sp) * tuning.maxSpeed; }
        b.x = Math.max(0, Math.min(100, b.x + b.vx));
        b.y = Math.max(0, Math.min(100, b.y + b.vy));
      }

      // --- draw ---
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const sx = canvas.width / 100, sy = canvas.height / 100;

      if (showHumans) {
        ctx.fillStyle = 'rgba(80,140,255,0.9)';
        for (const [, hp] of humanList) {
          ctx.beginPath();
          ctx.arc(hp.x * sx, hp.y * sy, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }

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

      // Refresh badge ~1x/sec (one intentional React render per second).
      if (t - lastBadge > 1000) {
        lastBadge = t;
        setHumanCount(stream.positionsRef.current.size);
        setSwarmSize(boids.length);
      }

      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [stream, boidCount, isBoidCountPerHuman, mode, showHumans]);

  return (
    <div style={{ position: 'relative', width: '100%', height: 480, background: '#111', borderRadius: 8 }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      <div
        style={{
          position: 'absolute', top: 8, left: 8, font: '12px/1.5 monospace',
          color: '#ccc', background: 'rgba(0,0,0,0.6)', padding: '6px 8px', borderRadius: 6,
        }}
      >
        {stream.status && (
          <div style={{ color: STATUS_COLOR[stream.status] ?? '#ccc', marginBottom: 2 }}>
            ws: {stream.status}
          </div>
        )}
        humans: <span style={{ color: humanCount > 0 ? '#9f9' : '#888' }}>{humanCount}</span><br />
        boids: {swarmSize}{isBoidCountPerHuman ? ` (${boidCount}/human)` : ''} · mode: {mode}<br />
        <span style={{ opacity: 0.5 }}>React renders: {renderCountRef.current}</span>
      </div>
    </div>
  );
}
