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
};

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
