import { useEffect, useRef, useState } from 'react';
import { applyPairwiseForces, computeCoeffMatrix, integrateParticles } from './physics';
import { hueForUser } from './constants';
import type { Params, Particle } from './types';

export interface ParticleFieldStream {
  /** Per-frame readable. userId → normalized (0-100) cursor position. */
  positionsRef: React.MutableRefObject<Map<string, { x: number; y: number }>>;
  status?: string;
}

const STATUS_COLOR: Record<string, string> = {
  connected: '#2a8f4f', connecting: '#a68a00', disconnected: '#b23b3b', error: '#b23b3b',
};

export default function ParticleFieldCanvas({
  stream,
  params,
  showCursors,
}: {
  stream: ParticleFieldStream;
  params: Params;
  showCursors: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  // Read tuning live from a ref so slider drags apply without restarting the sim.
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const showCursorsRef = useRef(showCursors);
  showCursorsRef.current = showCursors;
  const [humanCount, setHumanCount] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d')!;

    const particles = particlesRef.current;
    // Persistent PRNG so particles spawned mid-run (as users join) keep
    // getting fresh scatter positions rather than repeating a fixed seed.
    let seed = 12345;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

    let raf = 0;
    let last = performance.now();
    let lastBadge = 0;

    const step = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const P = paramsRef.current;

      const w = wrap.clientWidth, h = wrap.clientHeight;
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;

      // Live cursors, normalized 0-100 → 0-1 (matches the space `proximityRange` is tuned against).
      const rawCursors = stream.positionsRef.current;
      const cursors01 = new Map<string, { x: number; y: number }>();
      for (const [id, p] of rawCursors) cursors01.set(id, { x: p.x / 100, y: p.y / 100 });

      // Reconcile the particle pool per-owner: spawn for new users, drop departed users' particles.
      const presentOwners = new Set(particles.map(p => p.ownerId));
      for (const id of rawCursors.keys()) {
        if (presentOwners.has(id)) continue;
        for (let k = 0; k < P.multiplier; k++) {
          particles.push({ x: rnd() * w, y: rnd() * h, vx: 0, vy: 0, ownerId: id });
        }
      }
      if (particles.length) {
        for (let i = particles.length - 1; i >= 0; i--) {
          if (!rawCursors.has(particles[i].ownerId)) particles.splice(i, 1);
        }
      }

      const coeffM = computeCoeffMatrix(cursors01, P);
      applyPairwiseForces(particles, coeffM, P, dt);
      integrateParticles(particles, P, dt, w, h);

      // ── draw (light theme) ──
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#f7f7f6';
      ctx.fillRect(0, 0, w, h);

      if (showCursorsRef.current) {
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        for (const [, p] of rawCursors) {
          const px = (p.x / 100) * w, py = (p.y / 100) * h;
          ctx.beginPath();
          ctx.arc(px, py, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      for (const p of particles) {
        const hue = hueForUser(p.ownerId);
        ctx.fillStyle = `hsla(${hue}, 70%, 45%, 0.85)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      if (t - lastBadge > 1000) {
        lastBadge = t;
        setHumanCount(rawCursors.size);
      }

      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [stream]);

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', height: '100%', background: '#f7f7f6' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      {stream.status && (
        <div
          style={{
            position: 'absolute', bottom: 8, left: 8,
            font: '11px/1.4 monospace', color: STATUS_COLOR[stream.status] ?? '#555',
            background: 'rgba(255,255,255,0.8)', padding: '3px 7px', borderRadius: 5,
          }}
        >
          ws: {stream.status} · humans: {humanCount}
        </div>
      )}
    </div>
  );
}
