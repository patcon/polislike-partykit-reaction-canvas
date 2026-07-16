import { useEffect, useRef, useState } from 'react';
import { createNoise2D } from 'simplex-noise';
import { applyPairwiseForces, computeCoeffMatrix, integrateParticles } from './physics';
import {
  hueForUser,
  CHILD_SPRING_STIFFNESS, CHILD_SPRING_DAMPING, CHILD_ORBIT_RADIUS, CHILD_NOISE_RADIUS, CHILD_NOISE_SPEED,
} from './constants';
import { makePrng, noiseWanderOffset } from '../../app/lib/simulation/programs/_easing';
import type { Params, Particle } from './types';

export interface ParticleFieldStream {
  /** Per-frame readable. userId → normalized (0-100) cursor position. */
  positionsRef: React.MutableRefObject<Map<string, { x: number; y: number }>>;
  /**
   * Per-frame readable set of connected userIds — independent of
   * `positionsRef`. Drives particle-pool membership so a participant's swarm
   * appears the instant they connect and persists (dimmed) while they're
   * connected but not touching, instead of popping in/out with touch state.
   */
  connectedRef: React.MutableRefObject<Set<string>>;
  status?: string;
}

// Alpha for a particle whose owner is connected but not actively touching —
// dimmed toward neutral rather than disappearing, per particle-valence-experiments.
const IDLE_ALPHA = 0.18;
const ACTIVE_ALPHA = 0.85;

const STATUS_COLOR: Record<string, string> = {
  connected: '#2a8f4f', connecting: '#a68a00', disconnected: '#b23b3b', error: '#b23b3b',
};

/** One owner's `multiplierStrategy: 'children'` follower cursor: springs toward
 *  the real cursor, with an independent noise wobble layered on top (read fresh
 *  each frame, not accumulated into x/y, so it can't drift the spring off-target). */
interface ChildCursorState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  noiseOffX: number;
  noiseOffY: number;
  /** Fixed per-child offset from the parent cursor, so siblings spread out
   *  around it instead of springing toward the exact same point. */
  offsetX: number;
  offsetY: number;
}

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
  const childCursorsRef = useRef<Map<string, ChildCursorState>>(new Map());
  // Read tuning live from a ref so slider drags apply without restarting the sim.
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const showCursorsRef = useRef(showCursors);
  showCursorsRef.current = showCursors;
  const [cursorCount, setCursorCount] = useState(0);
  const [humanCount, setHumanCount] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d')!;

    const particles = particlesRef.current;
    const childCursors = childCursorsRef.current;
    // Persistent PRNG so particles spawned mid-run (as users join) keep
    // getting fresh scatter positions rather than repeating a fixed seed.
    let seed = 12345;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const childRnd = makePrng(54321);
    const childNoise2D = createNoise2D(makePrng(54322));

    let raf = 0;
    let last = performance.now();
    let lastBadge = 0;
    let lastStrategy = paramsRef.current.multiplierStrategy;

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

      // Reconcile the particle pool per connected owner (not per active cursor): a
      // participant's swarm spawns as soon as their connection is instantiated and
      // stays until they disconnect, so it persists (dimmed) through touch lifts.
      const connectedOwners = stream.connectedRef.current;
      const presentOwners = new Set(particles.map(p => p.ownerId));
      for (const id of connectedOwners) {
        if (presentOwners.has(id)) continue;
        for (let k = 0; k < P.multiplier; k++) {
          const coeffKey = P.multiplierStrategy === 'children' ? `${id}#${k}` : id;
          particles.push({ x: rnd() * w, y: rnd() * h, vx: 0, vy: 0, ownerId: id, coeffKey });
        }
      }
      if (particles.length) {
        for (let i = particles.length - 1; i >= 0; i--) {
          if (!connectedOwners.has(particles[i].ownerId)) particles.splice(i, 1);
        }
      }

      // Re-key existing particles when the strategy toggles live (e.g. a story
      // control), rather than waiting for owners to reconnect.
      if (P.multiplierStrategy !== lastStrategy) {
        lastStrategy = P.multiplierStrategy;
        childCursors.clear();
        const perOwnerIndex = new Map<string, number>();
        for (const p of particles) {
          const k = perOwnerIndex.get(p.ownerId) ?? 0;
          perOwnerIndex.set(p.ownerId, k + 1);
          p.coeffKey = P.multiplierStrategy === 'children' ? `${p.ownerId}#${k}` : p.ownerId;
        }
      }

      // `children` strategy: each owner's particles react to `multiplier`
      // independent follower cursors (spring toward the real cursor + a noise
      // wobble) instead of all sharing the owner's raw position — so an
      // owner's own particles no longer cohere onto a single shared point.
      let coeffInput: Map<string, { x: number; y: number }>;
      if (P.multiplierStrategy === 'children') {
        coeffInput = new Map();
        const activeChildIds = new Set<string>();
        for (const [ownerId, pos] of rawCursors) {
          for (let k = 0; k < P.multiplier; k++) {
            const childId = `${ownerId}#${k}`;
            activeChildIds.add(childId);
            let c = childCursors.get(childId);
            if (!c) {
              const offsetX = (childRnd() * 2 - 1) * CHILD_ORBIT_RADIUS;
              const offsetY = (childRnd() * 2 - 1) * CHILD_ORBIT_RADIUS;
              c = {
                x: pos.x + offsetX, y: pos.y + offsetY, vx: 0, vy: 0,
                noiseOffX: childRnd() * 1000, noiseOffY: childRnd() * 1000,
                offsetX, offsetY,
              };
              childCursors.set(childId, c);
            }
            c.vx = c.vx * CHILD_SPRING_DAMPING + (pos.x + c.offsetX - c.x) * CHILD_SPRING_STIFFNESS;
            c.vy = c.vy * CHILD_SPRING_DAMPING + (pos.y + c.offsetY - c.y) * CHILD_SPRING_STIFFNESS;
            c.x += c.vx;
            c.y += c.vy;
            const wander = noiseWanderOffset(childNoise2D, c.noiseOffX, c.noiseOffY, t, CHILD_NOISE_SPEED, CHILD_NOISE_RADIUS);
            coeffInput.set(childId, { x: (c.x + wander.x) / 100, y: (c.y + wander.y) / 100 });
          }
        }
        for (const id of [...childCursors.keys()]) {
          if (!activeChildIds.has(id)) childCursors.delete(id);
        }
      } else {
        if (childCursors.size) childCursors.clear();
        coeffInput = cursors01;
      }

      const coeffM = computeCoeffMatrix(coeffInput, P);
      applyPairwiseForces(particles, coeffM, P, dt);
      integrateParticles(particles, P, dt, w, h);

      // ── draw (light theme) ──
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#f7f7f6';
      ctx.fillRect(0, 0, w, h);

      if (showCursorsRef.current) {
        for (const [id, p] of rawCursors) {
          const hue = hueForUser(id);
          const px = (p.x / 100) * w, py = (p.y / 100) * h;

          // Same hue as this owner's particles, but larger with a glow + thick
          // border so the cursor itself reads as obviously distinct from them.
          ctx.beginPath();
          ctx.arc(px, py, 9, 0, Math.PI * 2);
          ctx.save();
          ctx.shadowColor = `hsla(${hue}, 80%, 40%, 0.7)`;
          ctx.shadowBlur = 14;
          ctx.fillStyle = `hsla(${hue}, 75%, 50%, 0.9)`;
          ctx.fill();
          ctx.restore();

          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(0,0,0,0.6)';
          ctx.stroke();
        }

        // `children` strategy: draw each follower cursor — the actual (sprung
        // + noise-wobbled) point feeding the coefficient matrix, not just the
        // real cursor it's chasing — as a small hollow ring so it reads as
        // distinct from both the parent cursor dot and the particles.
        if (P.multiplierStrategy === 'children') {
          for (const [childId, p] of coeffInput) {
            const hue = hueForUser(childId.slice(0, childId.lastIndexOf('#')));
            const px = p.x * w, py = p.y * h;
            ctx.beginPath();
            ctx.arc(px, py, 3, 0, Math.PI * 2);
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = `hsla(${hue}, 80%, 35%, 0.75)`;
            ctx.stroke();
          }
        }
      }

      for (const p of particles) {
        const hue = hueForUser(p.ownerId);
        const alpha = rawCursors.has(p.ownerId) ? ACTIVE_ALPHA : IDLE_ALPHA;
        ctx.fillStyle = `hsla(${hue}, 70%, 45%, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      if (t - lastBadge > 1000) {
        lastBadge = t;
        setCursorCount(rawCursors.size);
        let humans = 0;
        for (const id of rawCursors.keys()) if (!id.startsWith('sim_')) humans++;
        setHumanCount(humans);
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
          ws: {stream.status} · cursors: {cursorCount} (humans: {humanCount})
        </div>
      )}
    </div>
  );
}
