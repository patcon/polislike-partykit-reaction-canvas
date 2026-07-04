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

/** A single wandering user: current position and its current target. */
export interface Wanderer {
  x: number;
  y: number;
  tx: number;
  ty: number;
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
  const users: Wanderer[] = [];
  for (let i = 0; i < cfg.count; i++) {
    const p = cfg.initial(i, rnd);
    users.push({ x: p.x, y: p.y, tx: p.x, ty: p.y });
  }
  return {
    users,
    step() {
      for (let i = 0; i < users.length; i++) {
        const u = users[i];
        if (Math.hypot(u.tx - u.x, u.ty - u.y) < arrive) {
          const t = cfg.pickTarget(i, rnd);
          u.tx = t.x;
          u.ty = t.y;
        }
        u.x += (u.tx - u.x) * ease;
        u.y += (u.ty - u.y) * ease;
      }
    },
  };
}
