export interface Statement {
  statementId: number;
  timecode: number;
  text: string;
}

export type ActivityMode = 'canvas' | 'soccer' | 'image-canvas' | 'social-sharing' | 'mood-tones' | 'treevites' | 'greeter' | 'signature' | 'steno' | 'story-tracer' | 'voice-call' | 'map-maker' | 'map-viewer' | 'valence-beat-pad' | 'arrival-canvas' | 'neighbor' | 'screen-light' | 'light-show';

export interface MapProjection {
  coords: [string, [number, number]][];
  algorithm: string;
  computedAt: string;
}

export type ValenceInputMode = 'touch' | 'orientation-horizontal' | 'orientation-vertical' | 'orientation-rotation';

export interface MapViewerConfig {
  colorMode: 'none' | 'moment' | 'now';
  momentId: string | null;
}

export interface SocialConfig {
  default: string;
  twitter: string;
  bluesky: string;
  mastodon: string;
  instagram: string;
}