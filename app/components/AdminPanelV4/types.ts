import type { ReactionRegion, ReactionAnchors } from "../../utils/voteRegion";
import { DEFAULT_ANCHORS } from "../../utils/voteRegion";

export type RecordingMode = 'transitions' | 'positions';

export type AdminTab = 'record' | 'labels' | 'anchors' | 'avatars' | 'interfaces' | 'events' | 'participants' | 'moments';

export type PushTarget =
  | { kind: 'user'; userId: string }
  | { kind: 'region'; region: ReactionRegion | null }
  | { kind: 'users'; userIds: string[]; label: string };

export interface PlaybackFile {
  recordingStart: number;
  recordingEnd: number;
  room: string;
  mode: RecordingMode;
  events: object[];
}

export interface MomentSnapshot {
  id: string;
  label: string;
  timestamp: number;
  regions: Record<string, 'positive' | 'negative' | 'neutral' | null>;
}

export interface GithubSubmission {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  timestamp: number;
}

export function anchorToLocal(anchors: ReactionAnchors) {
  return {
    positiveX: String(anchors.positive.x),
    positiveY: String(anchors.positive.y),
    negativeX: String(anchors.negative.x),
    negativeY: String(anchors.negative.y),
    neutralX:  String(anchors.neutral.x),
    neutralY:  String(anchors.neutral.y),
  };
}

export const DEFAULT_ANCHOR_LOCALS = anchorToLocal(DEFAULT_ANCHORS);
