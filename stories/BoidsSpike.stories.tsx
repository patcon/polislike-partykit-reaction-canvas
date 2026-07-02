import React, { useEffect, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

/**
 * BOIDS SPIKE — prototype-first validation of the useCoordStream() contract.
 *
 * Idea one-pager: docs/ideas/coord-panel-slots.md
 *
 * What this spike proves (the two hard assumptions):
 *   #1  The coordinate stream separates cleanly from rendering/animation.
 *       Here the "stream" is a bare { positionsRef } — no D3, no React state,
 *       no rendering concerns. Boids is a pure consumer.
 *   #2  positionsRef is readable ~60fps WITHOUT per-frame React re-renders.
 *       Humans live in a ref; the boids RAF loop reads ref.current each frame.
 *       The on-screen "React renders" badge should stay ~constant while the
 *       sim runs. If it climbs every frame, the contract shape is wrong.
 *
 * The human data (read-only) drives an autonomous boids sim. Humans are never
 * affected by the boids — exactly the "render-others owns its own layout +
 * glyph + animation" thesis. Coordinates are 0..100 normalized, matching the
 * real cursor stream.
 */

// --- The contract we're prototyping (mock of useCoordStream) --------------

type Vec = { x: number; y: number };

interface CoordStream {
  /** Per-frame readable. Same shape the real hook would fill from cursorBatch. */
  positionsRef: React.MutableRefObject<Map<string, Vec>>;
}

/**
 * Mock stream: N humans wandering via their own RAF, written into a ref.
 * This mirrors how the real useCoordStream would write incoming socket
 * positions into a ref (never per-cursor React state).
 */
function useMockCoordStream(count: number): CoordStream {
  const positionsRef = useRef<Map<string, Vec>>(new Map());
  // Per-human wander target + velocity, kept out of React entirely.
  const stateRef = useRef<Map<string, { x: number; y: number; tx: number; ty: number }>>(new Map());

  useEffect(() => {
    // Reconcile the human set when count changes (join/leave churn).
    const s = stateRef.current;
    const p = positionsRef.current;
    for (const id of [...s.keys()]) {
      const idx = Number(id.slice(1));
      if (idx >= count) { s.delete(id); p.delete(id); }
    }
    for (let i = 0; i < count; i++) {
      const id = `h${i}`;
      if (!s.has(id)) {
        const x = 10 + ((i * 37) % 80);
        const y = 10 + ((i * 53) % 80);
        s.set(id, { x, y, tx: x, ty: y });
        p.set(id, { x, y });
      }
    }

    let raf = 0;
    let seed = count * 991 + 7; // deterministic wander; no Math.random churn
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

    const tick = () => {
      for (const [id, h] of s) {
        // Pick a new wander target occasionally.
        if (Math.hypot(h.tx - h.x, h.ty - h.y) < 3) {
          h.tx = 8 + rnd() * 84;
          h.ty = 8 + rnd() * 84;
        }
        h.x += (h.tx - h.x) * 0.02;
        h.y += (h.ty - h.y) * 0.02;
        p.set(id, { x: h.x, y: h.y });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [count]);

  return { positionsRef };
}

// --- Boids sim (pure consumer of the stream) ------------------------------

type PairingMode = 'dynamic' | 'strict';

interface Boid { x: number; y: number; vx: number; vy: number; human?: string }

interface BoidTuning {
  /** Pull toward the human target. Low = aloof, high = clingy. */
  humanAttraction: number;
  /** Ring radius (0..100) boids try to keep from their human. High = keep distance. */
  personalSpace: number;
  separation: number;
  alignment: number;
  cohesion: number;
  maxSpeed: number;
}

function BoidsCanvas({
  stream,
  boidCount,
  mode,
  showHumans,
  tuning,
}: {
  stream: CoordStream;
  boidCount: number;
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
  const [renderBadge, setRenderBadge] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    // (Re)seed boids to the requested count.
    const boids = boidsRef.current;
    let bseed = 12345;
    const rnd = () => { bseed = (bseed * 1103515245 + 12345) & 0x7fffffff; return bseed / 0x7fffffff; };
    while (boids.length < boidCount) {
      const i = boids.length;
      boids.push({ x: rnd() * 100, y: rnd() * 100, vx: 0, vy: 0, human: `h${i}` });
    }
    boids.length = boidCount;

    let raf = 0;
    let lastBadge = 0;

    const step = (t: number) => {
      const tuning = tuningRef.current; // live-tunable, no sim restart
      // READ THE STREAM — the whole point. ref.current, no React involved.
      const humans = stream.positionsRef.current;
      const humanList = [...humans.entries()];

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

      // Refresh the render badge ~1x/sec (a React render, on purpose — proves
      // the sim itself is NOT causing renders; only this throttled tick is).
      if (t - lastBadge > 1000) { lastBadge = t; setRenderBadge((n) => n + 1); }

      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [stream, boidCount, mode, showHumans]);

  return (
    <div style={{ position: 'relative', width: '100%', height: 480, background: '#111', borderRadius: 8 }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      <div
        style={{
          position: 'absolute', top: 8, left: 8, font: '12px/1.5 monospace',
          color: '#9f9', background: 'rgba(0,0,0,0.5)', padding: '6px 8px', borderRadius: 6,
        }}
      >
        mode: {mode}<br />
        boids: {boidCount}<br />
        React renders: {renderCountRef.current}
        <span style={{ opacity: 0.6 }}> (badge tick #{renderBadge})</span><br />
        <span style={{ opacity: 0.6 }}>↑ should stay tiny while sim runs</span>
      </div>
    </div>
  );
}

function BoidsSpike({
  humanCount,
  boidCount,
  mode,
  showHumans,
  humanAttraction,
  personalSpace,
  separation,
  alignment,
  cohesion,
  maxSpeed,
}: {
  humanCount: number;
  boidCount: number;
  mode: PairingMode;
  showHumans: boolean;
} & BoidTuning) {
  const stream = useMockCoordStream(humanCount);
  return (
    <BoidsCanvas
      stream={stream}
      boidCount={boidCount}
      mode={mode}
      showHumans={showHumans}
      tuning={{ humanAttraction, personalSpace, separation, alignment, cohesion, maxSpeed }}
    />
  );
}

const meta = {
  title: 'Spikes/BoidsSpike',
  component: BoidsSpike,
  parameters: { layout: 'padded' },
  argTypes: {
    mode: { control: 'radio', options: ['dynamic', 'strict'] },
    humanCount: { control: { type: 'range', min: 0, max: 30, step: 1 } },
    boidCount: { control: { type: 'range', min: 0, max: 400, step: 10 } },
    humanAttraction: { control: { type: 'range', min: 0, max: 0.4, step: 0.01 } },
    personalSpace: { control: { type: 'range', min: 0, max: 40, step: 1 } },
    separation: { control: { type: 'range', min: 0, max: 0.2, step: 0.01 } },
    alignment: { control: { type: 'range', min: 0, max: 0.2, step: 0.01 } },
    cohesion: { control: { type: 'range', min: 0, max: 0.05, step: 0.002 } },
    maxSpeed: { control: { type: 'range', min: 0.2, max: 4, step: 0.1 } },
  },
} satisfies Meta<typeof BoidsSpike>;

export default meta;
type Story = StoryObj<typeof meta>;

const CLINGY: BoidTuning = {
  humanAttraction: 0.12, personalSpace: 0, separation: 0.06,
  alignment: 0.05, cohesion: 0.008, maxSpeed: 1.6,
};

/** Dynamic allocation: boids steer toward whichever human is nearest each frame. */
export const DynamicAllocation: Story = {
  args: { humanCount: 8, boidCount: 200, mode: 'dynamic', showHumans: true, ...CLINGY },
};

/** Strict 1:1: each boid shadows its assigned human (falls back to nearest if it leaves). */
export const StrictPairing: Story = {
  args: { humanCount: 12, boidCount: 12, mode: 'strict', showHumans: true, ...CLINGY },
};

/**
 * Aloof: weak attraction + wide personalSpace, so boids loosely orbit the
 * crowd and drift on their own flocking rather than clinging to people.
 */
export const Aloof: Story = {
  args: {
    humanCount: 8, boidCount: 200, mode: 'dynamic', showHumans: true,
    humanAttraction: 0.03, personalSpace: 22, separation: 0.08,
    alignment: 0.08, cohesion: 0.012, maxSpeed: 1.6,
  },
};
