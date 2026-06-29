import type { ReactionAnchors } from './lib/reactionRegion';

export type { ReactionAnchors };

export interface CursorPosition {
  x: number;
  y: number;
  timestamp: number;
  userId: string;
}

export interface CursorEvent {
  type: 'move' | 'touch' | 'remove';
  position: CursorPosition;
}

export interface PersistedState {
  pluginStates?: Record<string, unknown>;
}

export interface SetTimecodeEvent        { type: 'setTimecode'; timecode: number }
export interface SetRecordingStateEvent  { type: 'setRecordingState'; recording: boolean }
export interface SetRoomLabelsEvent      { type: 'setRoomLabels'; labels: { positive: string; negative: string; neutral: string } | null }
export interface SetRoomAnchorsEvent     { type: 'setRoomAnchors'; anchors: ReactionAnchors | null }
export interface SetRoomAvatarStyleEvent { type: 'setRoomAvatarStyle'; avatarStyle: string | null }
export interface SetActivityEvent        { type: 'setActivity'; activity: string }
export interface SetImageUrlEvent        { type: 'setImageUrl'; url: string }
export interface ResetSoccerScoreEvent   { type: 'resetSoccerScore' }
export interface SetUserCapEvent         { type: 'setUserCap'; cap: number | null }
export interface SetNowLabelEvent        { type: 'setNowLabel'; label: string }
export interface SetSocialConfigEvent    { type: 'setSocialConfig'; config: { default: string; twitter: string; bluesky: string; mastodon: string } | null }
export interface SetGreeterConfigEvent   { type: 'setGreeterConfig'; config: { eventUrl: string } | null }
export interface RequestJoinEvent        { type: 'requestJoin' }
export interface ResetSoccerScore        { type: 'resetSoccerScore' }

export interface TriggerActivityEvent {
  type: 'triggerActivity';
  activityName: 'githubUsername' | 'feedbackStars';
  targetUserId?: string;
  targetRegion?: 'positive' | 'negative' | 'neutral' | null;
  targetUserIds?: string[];
}

export interface SubmitFeedbackStarsEvent {
  type: 'submitFeedbackStars';
  userId: string;
  stars: number;
  timestamp: number;
}

export interface SubmitGithubUsernameEvent {
  type: 'submitGithubUsername';
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  timestamp: number;
}

export interface PlaybackCursorBroadcastEvent {
  type: 'playbackCursorBroadcast';
  cursorType: 'move' | 'touch' | 'remove';
  position: CursorPosition;
}

export interface PushInterfaceEvent {
  type: 'pushInterface';
  targetUserId?: string;
  targetRegion?: 'positive' | 'negative' | 'neutral' | null;
  targetUserIds?: string[];
  interfaceName: string;
  payload?: Record<string, unknown>;
}

export interface AcceptInterfaceEvent    { type: 'acceptInterface'; interfaceName: string }
export interface ClearPushedInterfacesEvent { type: 'clearPushedInterfaces' }

export interface PushHapticEvent {
  type: 'pushHaptic';
  targetUserId?: string;
  targetRegion?: 'positive' | 'negative' | 'neutral' | null;
  targetUserIds?: string[];
}

export interface RecordInvitationsEvent  { type: 'recordInvitations'; edges: Array<[string, string]> }
export interface RegisterCustomAvatarEvent { type: 'registerCustomAvatar'; userId: string; photoUrl: string }
export interface SetColorCursorsByVoteEvent { type: 'setColorCursorsByVote'; enabled: boolean }
export interface SetDefaultCursorColorEvent { type: 'setDefaultCursorColor'; color: string }
export interface SetOwnValenceDisplayEvent  { type: 'setOwnValenceDisplay'; mode: 'background' | 'labels' | 'none' }
export interface SetValenceInputModeEvent   { type: 'setValenceInputMode'; mode: 'touch' | 'orientation-horizontal' | 'orientation-vertical' | 'orientation-rotation' }

export interface StrokeSegmentEvent {
  type: 'strokeSegment';
  userId: string;
  strokeId: string;
  points: Array<{ x: number; y: number }>;
  isFinal: boolean;
}

export interface ClearSignatureEvent     { type: 'clearSignature'; userId: string }


export interface SetArrivalCapacityEvent { type: 'setArrivalCapacity'; capacity: number }
export interface GetPresenceCountEvent   { type: 'getPresenceCount' }

export interface NeighborEdgeEvent          { type: 'neighborEdge';       from: string; toCode: string }
export interface RequestNeighborEdgesEvent  { type: 'requestNeighborEdges' }
export interface ClearNeighborEdgesEvent    { type: 'clearNeighborEdges' }

export interface SetLightColorEvent      { type: 'setLightColor'; color: string; brightness: number }

export type ClientEvent =
  | CursorEvent | SetTimecodeEvent
  | SetRecordingStateEvent | SetRoomLabelsEvent | SetRoomAnchorsEvent
  | SetRoomAvatarStyleEvent | SetActivityEvent | SetImageUrlEvent
  | ResetSoccerScoreEvent | SetUserCapEvent | RequestJoinEvent
  | PlaybackCursorBroadcastEvent | TriggerActivityEvent | SubmitGithubUsernameEvent
  | SubmitFeedbackStarsEvent | SetSocialConfigEvent | SetGreeterConfigEvent
  | PushInterfaceEvent | AcceptInterfaceEvent | ClearPushedInterfacesEvent
  | PushHapticEvent | SetNowLabelEvent | RecordInvitationsEvent
  | RegisterCustomAvatarEvent | SetColorCursorsByVoteEvent | SetDefaultCursorColorEvent
  | SetOwnValenceDisplayEvent | SetValenceInputModeEvent | StrokeSegmentEvent
  | ClearSignatureEvent
  | SetArrivalCapacityEvent | GetPresenceCountEvent
  | NeighborEdgeEvent | RequestNeighborEdgesEvent | ClearNeighborEdgesEvent
  | SetLightColorEvent;
