export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: string;
  /**
   * Key used to look up this particle's row in the pairwise coefficient
   * matrix. Defaults to `ownerId` (all of one owner's particles share a
   * coefficient row against another owner — `multiplierStrategy: 'basic'`).
   * `multiplierStrategy: 'children'` instead gives each particle its own
   * per-child-cursor key, so siblings can carry different coefficients.
   */
  coeffKey?: string;
}

export interface Params {
  forceScale: number;
  proximityRange: number;
  invert: boolean;
  coreRadius: number;
  falloff: number;
  friction: number;
  maxSpeed: number;
  centerGravity: number;
  multiplier: number;
  /**
   * `basic` (default): all of an owner's particles react to the owner's raw
   * cursor position as one shared coefficient. `children`: spawn `multiplier`
   * independent "child cursors" per owner that spring+noise-follow the real
   * cursor, and feed each into the coefficient matrix separately — so forces
   * between an owner's own particles vary instead of all cohering identically.
   */
  multiplierStrategy: 'basic' | 'children';
  /**
   * `none` (default): pairwise force is purely radial (toward/away from the
   * other particle). `swirl-*`: adds a tangential component (strength scales
   * low → high) so particles curve around each other instead of approaching
   * head-on. See `SWIRL_STRENGTH` in constants.ts for the tier values.
   */
  dynamism: 'none' | 'swirl-low' | 'swirl-medium' | 'swirl-high';
}
