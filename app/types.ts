export interface PolisStatement {
  txt: string;
  tid: number;
  created?: string;
  quote_src_url?: string | null;
  is_seed?: boolean;
  is_meta?: boolean;
  lang?: string;
  pid?: number;
  velocity?: number;
  mod?: number;
  active?: boolean;
  agree_count?: number;
  disagree_count?: number;
  pass_count?: number;
  count?: number;
  conversation_id?: string;
}

export interface QueueItem {
  statementId: number;
  displayTimestamp: number;
}

export interface Statement {
  statementId: number;
  timecode: number;
  text: string;
}

export type ActivityMode = 'canvas' | 'soccer' | 'image-canvas' | 'social' | 'mood-tones' | 'treevites' | 'greeter' | 'signature' | 'steno' | 'story-tracer' | 'voice-call' | 'map-maker' | 'map-viewer';

export interface MapProjection {
  coords: [string, [number, number]][];
  algorithm: string;
  computedAt: string;
}

export interface StoryTracerPoint {
  x: number
  y: number
  z: number
  text: string
  startTime?: string
}

export interface StoryTracerMeta {
  modelId: string
  algorithmId: string
  windowSize: number
  overlapPct: number
  segmentCount: number
  computedAt: string
}

export type ValenceInputMode = 'touch' | 'orientation-horizontal' | 'orientation-vertical' | 'orientation-rotation';

export interface GreeterConfig {
  eventUrl: string;
}

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