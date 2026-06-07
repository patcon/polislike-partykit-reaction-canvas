export interface StenoState {
  vtt: string;
  lockUserId: string | null;
  connUsers: Map<string, string>;
}

export interface StoryTracerState {
  points: StoryTracerPoint[] | null;
  meta: StoryTracerMeta | null;
}

export interface StoryTracerPoint {
  x: number;
  y: number;
  z: number;
  text: string;
  startTime?: string;
}

export interface StoryTracerMeta {
  modelId: string;
  algorithmId: string;
  windowSize: number;
  overlapPct: number;
  segmentCount: number;
  computedAt: string;
}
