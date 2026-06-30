export interface Statement {
  statementId: number;
  timecode: number;
  text: string;
}


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