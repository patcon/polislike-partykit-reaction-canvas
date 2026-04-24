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

export type ActivityMode = 'canvas' | 'soccer' | 'image-canvas' | 'social';

export interface VizConfig {
  viewMode: '2d' | '2d-ts' | '3d';
  geometry: 'diametric' | 'parallel' | 'linear' | 'radial';
  animation: 'sequential' | 'simultaneous';
  traces: 'correlated' | 'random';
  order: 'random' | 'grouped';
  groups: number;
  chords: number;
  showGuides: boolean;
  cursorStyle: 'valence' | 'group';
  radialStyle: 'valence' | 'group';
  traceStyle: 'valence' | 'group';
  fillStyle: 'valence' | 'group';
  stylePastLikeCursor: boolean;
  cursorOpacity: number;
  radialOpacity: number;
  colorPositive: string;
  colorNegative: string;
  colorNeutral: string;
  eventFrequency: number;
  driftSpeed: number;
  exitAnimation: 'origin' | 'none';
  chordPersistence: 'persistent' | 'redistributed';
  radialWidth: number;
  cursorSize: number;
  useGeometry: boolean;
}

export interface VizCameraState {
  viewMode: '2d' | '2d-ts' | '3d';
  theta: number;
  phi: number;
  radius: number;
}

export interface SocialConfig {
  default: string;
  twitter: string;
  bluesky: string;
  mastodon: string;
  instagram: string;
}