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

/** userId → hue, matching the hash used for cursor dot color in CursorField.tsx. */
export function hueForUser(userId: string): number {
  return userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360;
}
