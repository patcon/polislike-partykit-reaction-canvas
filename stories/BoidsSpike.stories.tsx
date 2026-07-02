import React, { useEffect, useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { BoidsCanvas, type BoidTuning, type CoordStream, type PairingMode } from './boids-shared';

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
 *
 * For the live-room version (real PartyKit cursors), see BoidsSpikeLive.stories.tsx.
 */

// --- Mock coord stream: N humans wandering, written into a ref ---------------

/**
 * Mock stream: N humans wandering via their own RAF, written into a ref.
 * This mirrors how the real useCoordStream would write incoming socket
 * positions into a ref (never per-cursor React state).
 */
function useMockCoordStream(count: number): CoordStream {
  const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
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

// --- Story component ---------------------------------------------------------

function BoidsSpike({
  humanCount,
  boidCount,
  isBoidCountPerHuman,
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
  isBoidCountPerHuman: boolean;
  mode: PairingMode;
  showHumans: boolean;
} & BoidTuning) {
  const stream = useMockCoordStream(humanCount);
  return (
    <BoidsCanvas
      stream={stream}
      boidCount={boidCount}
      isBoidCountPerHuman={isBoidCountPerHuman}
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
    isBoidCountPerHuman: { control: 'boolean' },
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
  args: { humanCount: 8, boidCount: 200, isBoidCountPerHuman: false, mode: 'dynamic', showHumans: true, ...CLINGY },
};

/** Strict 1:1: each boid shadows its assigned human (falls back to nearest if it leaves). */
export const StrictPairing: Story = {
  args: { humanCount: 12, boidCount: 12, isBoidCountPerHuman: false, mode: 'strict', showHumans: true, ...CLINGY },
};

/**
 * 30 boids per human: `boidCount` is reinterpreted as a per-human multiplier,
 * so the swarm grows and shrinks as humans join/leave. Drag `humanCount` and
 * watch the total track it (6 humans → 180 boids).
 */
export const ThirtyPerHuman: Story = {
  args: { humanCount: 6, boidCount: 30, isBoidCountPerHuman: true, mode: 'dynamic', showHumans: true, ...CLINGY },
};

/**
 * Aloof: weak attraction + wide personalSpace, so boids loosely orbit the
 * crowd and drift on their own flocking rather than clinging to people.
 */
export const Aloof: Story = {
  args: {
    humanCount: 8, boidCount: 200, isBoidCountPerHuman: false, mode: 'dynamic', showHumans: true,
    humanAttraction: 0.03, personalSpace: 22, separation: 0.08,
    alignment: 0.08, cohesion: 0.012, maxSpeed: 1.6,
  },
};
