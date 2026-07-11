// Shared "wander" core: N users each ease toward a target and pick a new target
// on arrival. Drift and Region-hoppers differ only in where targets come from,
// so both build on this. Motion is deterministic given a seed (no Math.random),
// which keeps program tests reproducible. Coords are normalized 0..100.
//
// Ported from the simulated humans in stories/BoidsSpike.stories.tsx.

/** Per-tick easing fraction toward the target (2% — smooth organic drift). */
export const EASE = 0.02;
/** Distance under which a user is "arrived" and picks a new target. */
export const ARRIVE_DIST = 3;

/** Cubic ease-in-out: slow start, fast middle, slow finish. `t` in 0..1. */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Eased 0..1 progress through a `duration`-long span starting at `start`,
 * clamped before `start` (0) and past `start + duration` (1). The shared
 * "how far through this glide am I" calculation used by every program that
 * eases a value toward a target over a fixed duration.
 */
export function easedProgress(tMs: number, start: number, duration: number): number {
  return easeInOutCubic(Math.max(0, Math.min((tMs - start) / duration, 1)));
}

/**
 * Sample a 2D simplex-noise offset for organic micro-wander around a point.
 * `offX`/`offY` give each user an independent stream from a shared `noise2D`
 * field; `speed` scales how fast the sample advances with `tMs`; `radius`
 * scales the offset magnitude (each axis stays within +/- radius).
 */
export function noiseWanderOffset(
  noise2D: (x: number, y: number) => number,
  offX: number,
  offY: number,
  tMs: number,
  speed: number,
  radius: number,
): { x: number; y: number } {
  const t = tMs * 0.001 * speed;
  return {
    x: noise2D(offX, t) * radius,
    y: noise2D(offY, t) * radius,
  };
}

/**
 * Deterministic LCG returning values in [0, 1). Seeded so a given seed always
 * produces the same sequence (unlike Math.random).
 * @param seed Any integer; 0 is coerced to 1 to avoid a stuck sequence.
 */
export function makePrng(seed: number): () => number {
  let s = (seed | 0) || 1;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/** A single wandering user: current position, current target, and dwell counter. */
export interface Wanderer {
  x: number;
  y: number;
  tx: number;
  ty: number;
  /** Steps remaining to wait at the current target before retargeting. */
  wait: number;
}

export interface WanderConfig {
  /** Number of users. */
  count: number;
  /** PRNG seed for reproducible motion. */
  seed: number;
  /** Initial position for user `i`. */
  initial: (i: number, rnd: () => number) => { x: number; y: number };
  /** Pick a fresh target for user `i` once it arrives at its current one. */
  pickTarget: (i: number, rnd: () => number) => { x: number; y: number };
  /** Easing fraction per step (defaults to {@link EASE}). */
  ease?: number;
  /** Arrival threshold (defaults to {@link ARRIVE_DIST}). */
  arriveDist?: number;
  /** Steps to pause at a target on arrival before picking a new one (default 0). */
  dwell?: number;
}

export interface WanderField {
  /** Advance every user one step: retarget on arrival, then ease toward target. */
  step(): void;
  /** The users' live state (read-only view). */
  readonly users: ReadonlyArray<Wanderer>;
}

/**
 * Build a wander field. Each user starts with its target equal to its initial
 * position, so the first `step()` immediately picks a real target.
 */
export function createWanderField(cfg: WanderConfig): WanderField {
  const rnd = makePrng(cfg.seed);
  const ease = cfg.ease ?? EASE;
  const arrive = cfg.arriveDist ?? ARRIVE_DIST;
  const dwell = cfg.dwell ?? 0;
  const users: Wanderer[] = [];
  for (let i = 0; i < cfg.count; i++) {
    const p = cfg.initial(i, rnd);
    users.push({ x: p.x, y: p.y, tx: p.x, ty: p.y, wait: 0 });
  }
  return {
    users,
    step() {
      for (let i = 0; i < users.length; i++) {
        const u = users[i];
        if (Math.hypot(u.tx - u.x, u.ty - u.y) < arrive) {
          if (u.wait > 0) {
            u.wait -= 1; // dwell at the target before moving on
          } else {
            const t = cfg.pickTarget(i, rnd);
            u.tx = t.x;
            u.ty = t.y;
            u.wait = dwell;
          }
        }
        u.x += (u.tx - u.x) * ease;
        u.y += (u.ty - u.y) * ease;
      }
    },
  };
}
