export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: string;
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
}
