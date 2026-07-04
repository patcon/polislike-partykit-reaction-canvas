// Realistic region-hoppers: a per-cursor MOVE/REST state machine ported from the
// old server-side GhostCursorManager. Cursors travel (eased) to a region hotspot,
// then *rest* there with simplex-noise micro-wander before hopping again. Adds
// per-cursor personality (active vs calm), timing jitter, inset hotspots (pulled
// off the extreme corners), and off-canvas entry — so a small crowd reads as real
// people rather than lerping dots.
//
// Determinism (for tests) is preserved: the wall clock is the tick's `tMs`, all
// randomness comes from a seeded PRNG, and the noise field is seeded too.

import { createNoise2D } from 'simplex-noise';
import type { CursorEvent, SimContext, SimulationProgram } from '../types';
import type { ReactionAnchors } from '../../../utils/voteRegion';
import { makePrng } from './_easing';

const HOTSPOT_PULL = 0.3;     // fraction pulled from the anchor toward canvas centre
const TARGET_JITTER = 6;      // spread of a picked target around its hotspot
const ACTIVE_PROB = 0.3;      // fraction of "active" (livelier) cursors
const MOVE_MIN = 2500, MOVE_JITTER = 2000;   // travel duration ms
const REST_MIN = 2000, REST_JITTER = 4000;   // rest duration ms
const BLEND_MS = 900;         // eased blend from arrival into the noise orbit
const ENTRY_START_JITTER = 2000; // stagger of the initial move-in

const clamp = (n: number) => Math.max(0, Math.min(100, n));
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Region anchors pulled `pull` of the way toward the canvas centre (50,50). */
export function regionHotspots(anchors: ReactionAnchors, pull = HOTSPOT_PULL): Array<{ x: number; y: number }> {
  return [anchors.positive, anchors.negative, anchors.neutral].map((a) => ({
    x: a.x + (50 - a.x) * pull,
    y: a.y + (50 - a.y) * pull,
  }));
}

interface Ghost {
  x: number; y: number;
  phase: 'move' | 'rest';
  fromX: number; fromY: number;
  targetX: number; targetY: number;
  moveStart: number; moveDuration: number;
  restStart: number; restDuration: number;
  arriveX: number; arriveY: number; // position when rest began (blend anchor)
  hotX: number; hotY: number;       // rest orbit centre
  noiseOffX: number; noiseOffY: number;
  restingSpeed: number; restingRadius: number;
}

export function createRealisticRegionHoppersProgram(): SimulationProgram {
  let ghosts: Ghost[] = [];
  let count = 0;
  let rnd: () => number = () => 0;
  let noise2D: (x: number, y: number) => number = () => 0;
  let hotspots: Array<{ x: number; y: number }> = [];

  const pickTarget = () => {
    const h = hotspots[Math.floor(rnd() * hotspots.length)];
    return { x: clamp(h.x + (rnd() * 2 - 1) * TARGET_JITTER), y: clamp(h.y + (rnd() * 2 - 1) * TARGET_JITTER) };
  };

  return {
    id: 'region-hoppers-realistic',
    label: 'Region-hoppers (realistic)',

    init(ctx: SimContext) {
      count = ctx.userCount;
      rnd = makePrng(ctx.seed);
      noise2D = createNoise2D(makePrng(ctx.seed + 1)); // independent seeded stream
      hotspots = regionHotspots(ctx.regionAnchors);
      ghosts = [];
      for (let i = 0; i < count; i++) {
        const active = rnd() < ACTIVE_PROB;
        // Off-canvas entry from one of the four edges.
        const side = Math.floor(rnd() * 4);
        const along = rnd() * 100;
        const start = side === 0 ? { x: along, y: -5 }
          : side === 1 ? { x: 105, y: along }
          : side === 2 ? { x: along, y: 105 }
          : { x: -5, y: along };
        const target = pickTarget();
        ghosts.push({
          x: start.x, y: start.y,
          phase: 'move',
          fromX: start.x, fromY: start.y,
          targetX: target.x, targetY: target.y,
          moveStart: rnd() * ENTRY_START_JITTER,
          moveDuration: MOVE_MIN + rnd() * MOVE_JITTER,
          restStart: 0, restDuration: 0,
          arriveX: start.x, arriveY: start.y,
          hotX: target.x, hotY: target.y,
          noiseOffX: rnd() * 1000, noiseOffY: rnd() * 1000,
          restingSpeed: active ? 0.8 + rnd() * 0.7 : 0.2 + rnd() * 0.4,
          restingRadius: active ? 4 + rnd() * 4 : 2 + rnd() * 3,
        });
      }
    },

    tick(tMs: number): CursorEvent[] {
      const out: CursorEvent[] = [];
      for (let i = 0; i < ghosts.length; i++) {
        const g = ghosts[i];
        if (g.phase === 'move') {
          const p = Math.max(0, Math.min((tMs - g.moveStart) / g.moveDuration, 1));
          const e = easeInOutCubic(p);
          g.x = g.fromX + (g.targetX - g.fromX) * e;
          g.y = g.fromY + (g.targetY - g.fromY) * e;
          if (p >= 1) {
            g.phase = 'rest';
            g.restStart = tMs;
            g.restDuration = REST_MIN + rnd() * REST_JITTER;
            g.arriveX = g.x; g.arriveY = g.y;
            g.hotX = g.x; g.hotY = g.y; // wander around where it landed
          }
        } else {
          const nt = tMs * 0.001 * g.restingSpeed;
          const nx = g.hotX + noise2D(g.noiseOffX, nt) * g.restingRadius;
          const ny = g.hotY + noise2D(g.noiseOffY, nt) * g.restingRadius;
          const b = easeInOutCubic(Math.min((tMs - g.restStart) / BLEND_MS, 1));
          g.x = g.arriveX + (nx - g.arriveX) * b;
          g.y = g.arriveY + (ny - g.arriveY) * b;
          if (tMs - g.restStart >= g.restDuration) {
            const target = pickTarget();
            g.phase = 'move';
            g.fromX = g.x; g.fromY = g.y;
            g.targetX = target.x; g.targetY = target.y;
            g.moveStart = tMs;
            g.moveDuration = MOVE_MIN + rnd() * MOVE_JITTER;
          }
        }
        out.push({ type: 'move', position: { x: clamp(g.x), y: clamp(g.y), timestamp: 0, userId: `sim_${i}` } });
      }
      return out;
    },

    teardown(): CursorEvent[] {
      return Array.from({ length: count }, (_, i) => ({
        type: 'remove',
        position: { x: 0, y: 0, timestamp: 0, userId: `sim_${i}` },
      }));
    },
  };
}
