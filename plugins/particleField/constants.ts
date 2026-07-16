import type { Params } from './types';

export const DEFAULT_PARAMS: Params = {
  forceScale: 180,     // overall force strength
  proximityRange: 0.4, // cursor distance (normalized 0-100 space) where attract flips to repel
  invert: false,       // false: close cursors attract, far cursors repel; true: flipped
  coreRadius: 22,      // px — inside this, particles always repel (personal space)
  falloff: 320,        // px — attraction fades to zero beyond this particle distance
  friction: 0.025,     // velocity damping per frame-ish
  maxSpeed: 480,       // px/s clamp
  centerGravity: 0,    // spring pull toward canvas center (0 = off)
  multiplier: 10,      // particles spawned per live cursor
  multiplierStrategy: 'basic',
  dynamism: 'none',
};

// Tangential-force multiplier applied per Params.dynamism tier — see
// applyPairwiseForces in physics.ts. 'swirl-high' keeps the original 0.6
// (what shipped as the sole 'swirl' option) as the strongest tier.
export const SWIRL_STRENGTH: Record<'swirl-low' | 'swirl-medium' | 'swirl-high', number> = {
  'swirl-low': 0.15,
  'swirl-medium': 0.35,
  'swirl-high': 0.6,
};

// `multiplierStrategy: 'children'` tuning — each owner's child cursors spring
// toward a fixed personal offset from the real cursor (not the exact same
// point), in normalized 0-100 space, with an independent simplex-noise wobble
// layered on top so siblings spread out around the parent instead of
// clustering on top of it. See ParticleFieldCanvas.tsx.
export const CHILD_SPRING_STIFFNESS = 0.06;
export const CHILD_SPRING_DAMPING = 0.85;
// Max per-child fixed offset from the parent cursor (each axis), canvas units.
export const CHILD_ORBIT_RADIUS = 14;
export const CHILD_NOISE_RADIUS = 4;
export const CHILD_NOISE_SPEED = 0.6;

/**
 * userId → hue (0-359). Unlike the plain char-sum hash used for cursor dot
 * color elsewhere (e.g. CursorField.tsx), this runs an avalanche finalizer
 * (Thomas Wang's integer hash) after the polynomial rolling hash, so ids
 * sharing a long common prefix and differing only by a trailing digit — like
 * the simulated `sim_wander_0`..`sim_wander_9` ids — still spread across the
 * full hue wheel instead of landing within ~1 degree of each other.
 */
export function hueForUser(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  hash = hash ^ (hash >>> 16);
  return Math.abs(hash) % 360;
}
