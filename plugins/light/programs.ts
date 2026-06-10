/** Per-participant animation state. Add fields per program (e.g. forestHue*, pulseHue*) as programs are introduced. Seeded once per participant; never mutated after creation. */
export type PhoneState = {
  /** Starting position in the greens palette [0, 1) */
  forestHueSeed: number;
  /** How fast the hue drifts through the palette — range [0.3, 1.0] so phones never lock in sync */
  forestHueSpeed: number;
  /** Phase offset for the brightness sine wave — radians in [0, 2π) */
  forestBrightnessSeed: number;
  /** How fast brightness pulses — range [0.4, 1.2] */
  forestBrightnessSpeed: number;
};

/** Returns a random initial PhoneState. Speed ranges are hand-tuned so phones drift at human-visible rates without looking synchronized. */
export function makePhoneState(): PhoneState {
  return {
    forestHueSeed:        Math.random(),
    forestHueSpeed:       0.3 + Math.random() * 0.7,
    forestBrightnessSeed: Math.random() * Math.PI * 2,
    forestBrightnessSpeed: 0.4 + Math.random() * 0.8,
  };
}

// Palette stops for the Forest program: deep forest → bright green → yellow-green → warm yellow → earthy brown.
// Each stop is [r, g, b] in [0, 1] at full brightness; _greensFromHueBri scales by bri at call time.
const _GREENS_STOPS: [number, number, number][] = [
  [0.05, 0.55, 0.08],
  [0.20, 0.85, 0.12],
  [0.72, 0.88, 0.08],
  [0.90, 0.78, 0.04],
  [0.55, 0.32, 0.04],
];

/**
 * Maps a hue position [0, 1) and brightness [0, 1] to an RGB triple by linearly
 * interpolating between adjacent _GREENS_STOPS entries, then scaling by bri.
 * Hue is clamped to 0.9999 so index i+1 never overflows the stops array.
 */
function _greensFromHueBri(hue: number, bri: number): [number, number, number] {
  const h   = Math.max(0, Math.min(0.9999, hue));
  const seg = h * (_GREENS_STOPS.length - 1);
  const i   = Math.floor(seg);
  const f   = seg - i;
  const a   = _GREENS_STOPS[i];
  const b   = _GREENS_STOPS[i + 1];
  return [
    (a[0] + (b[0] - a[0]) * f) * bri,
    (a[1] + (b[1] - a[1]) * f) * bri,
    (a[2] + (b[2] - a[2]) * f) * bri,
  ];
}

/**
 * Returns the Forest program color for one phone at time `ts` (seconds since program start).
 * Hue drifts linearly; brightness oscillates via a sine wave. The 0.04/0.9 multipliers
 * slow the raw speed values down to a comfortable visual tempo.
 */
export function greensRandom(state: PhoneState, ts: number): [number, number, number] {
  const hue = ((state.forestHueSeed + ts * state.forestHueSpeed * 0.04) % 1 + 1) % 1;
  const bri = 0.15 + 0.85 * (0.5 + 0.5 * Math.sin(state.forestBrightnessSeed + ts * state.forestBrightnessSpeed * 0.9));
  return _greensFromHueBri(hue, bri);
}

/** Linearly interpolates between two '#rrggbb' hex colors by t in [0, 1]. Used by the Pulse program. */
export function lerpColor(a: string, b: string, t: number): string {
  const parse = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const ac = parse(a);
  const bc = parse(b);
  return rgbToHex([
    (ac[0] + (bc[0] - ac[0]) * t) / 255,
    (ac[1] + (bc[1] - ac[1]) * t) / 255,
    (ac[2] + (bc[2] - ac[2]) * t) / 255,
  ]);
}

/** Converts an [r, g, b] triple (each channel in [0, 1]) to a '#rrggbb' hex string. Clamps channels before rounding. */
export function rgbToHex([r, g, b]: [number, number, number]): string {
  const ch = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');
  return `#${ch(r)}${ch(g)}${ch(b)}`;
}
