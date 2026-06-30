import { useState, useRef, type ReactNode } from "react";
import Canvas from "./CursorField";
import TouchLayer from "./TouchLayer";
import ShareQRButton from "./ShareQRButton";
import { DEFAULT_ANCHORS, reactionLabelStyle } from "../../utils/voteRegion";
import type { ReactionAnchors } from "../../utils/voteRegion";
import { SMOOTH_CURSOR_ENABLED, SMOOTH_CURSOR_CONFIG } from "../../utils/cursor";
import { REACTION_LABEL_PRESETS } from "../../voteLabels";
import type { ReactionLabelSet } from "../../voteLabels";
import type { GreeterConfig } from "../../../plugins/greeter/types";

type ReactionState = 'positive' | 'negative' | 'neutral' | null;

export interface ReactionCanvasParticipantProps {
  room: string;
  userId: string;

  // sizing / embedding
  autoSize?: boolean;          // forwarded to Canvas + TouchLayer; ignores heightOffset
  heightOffset?: number;

  // labels (precedence resolved by parent). undefined = use own server labels; null = hidden.
  labelsOverride?: ReactionLabelSet | null;
  showLabels?: boolean;        // default true (V4 passes activity === 'canvas')

  // canvas behavior flags (defaults match V4)
  colorCursorsByVote?: boolean;
  useCursorSmoothing?: boolean;
  disableCursorValence?: boolean;
  disableBackgroundValence?: boolean;
  debug?: boolean;

  // feature toggles
  showShareButton?: boolean;
  showPresenceCounter?: boolean;
  showRecBadge?: boolean;
  showDebugHint?: boolean;
  showNowLabel?: boolean;
  selfChain?: string[];
  shareUrl?: string;           // overrides ShareQR's window.location-derived URL (demo)

  // controlled state (V4 owns; demo omits). undefined = uncontrolled (null is a valid value).
  currentReactionState?: ReactionState;
  touchPos?: { x: number; y: number } | null;

  // touch gating
  touchDisabled?: boolean;
  hideTouchLayer?: boolean;
  touchImageUrl?: string;

  // extension slots (V4 injects; demo omits)
  topRightSlot?: ReactNode;
  bannerSlot?: ReactNode;
  canvasOverlay?: ReactNode;
  backgroundOverlay?: ReactNode;

  // server-state FORWARD callbacks (all optional)
  onSocketReady?: (send: (msg: string) => void) => void;
  onConnected?: (initialInviteEdges?: Record<string, string>, currentScreenPanel?: string) => void;
  onRoomLabelsChange?: (labels: ReactionLabelSet | null) => void;
  onRoomAnchorsChange?: (anchors: ReactionAnchors | null) => void;
  onRoomImageUrlChange?: (url: string) => void;
  onSocialConfigChange?: (config: { default: string; twitter: string; bluesky: string; mastodon: string; instagram: string } | null) => void;
  onGreeterConfigChange?: (config: GreeterConfig | null) => void;
  onOwnValenceDisplayChange?: (mode: 'background' | 'labels' | 'none') => void;
  onValenceInputModeChange?: (mode: 'touch' | 'orientation-horizontal' | 'orientation-vertical') => void;
  onNowLabelChange?: (label: string) => void;
  onInviteEdges?: (edges: Record<string, string>) => void;
  onConnectedUsers?: (ids: string[]) => void;
  onUserJoined?: (userId: string) => void;
  onUserLeft?: (userId: string) => void;
  onPresenceCount?: (count: number) => void;
  onActiveCursorCountChange?: (count: number) => void;
  onSimulatedCursorCountChange?: (count: number) => void;
  onRecordingStateChange?: (recording: boolean) => void;
  onViewerCount?: (count: number) => void;
  onConnectedAsViewer?: (isViewer: boolean, userCap: number | null) => void;
  onUserCapChanged?: (cap: number | null) => void;
  onJoinApproved?: () => void;
  onActivityTriggered?: (activityName: string) => void;

  onBackgroundColorChange?: (reactionState: ReactionState) => void;
  onTouchPosition?: (pos: { x: number; y: number } | null) => void;
}

/**
 * The participant reaction-canvas experience: reaction labels (with own-valence
 * coloring), the live Canvas (synced cursors + spring smoothing), the touch input
 * layer, the blue self-indicator, presence/REC/now-label chrome, and the share-QR
 * button. Rendered by both ReactionCanvasAppV4 (the real app shell) and the demo
 * pages, so they never drift.
 *
 * Renders a fragment into a `position: relative` parent (V4's
 * `.v2-vote-canvas-container` or the demo's `.demo-phone-content`).
 *
 * State is owned internally but mirrored out via the optional `on*` callbacks so a
 * parent shell (V4) can keep driving panel-switching, providers, and haptics.
 * `currentReactionState` and `touchPos` are controlled-or-uncontrolled: pass them
 * to take control (V4's orientation loop), omit them to let this component own them.
 */
export default function ReactionCanvasParticipant({
  room,
  userId,
  autoSize = false,
  heightOffset,
  labelsOverride,
  showLabels = true,
  colorCursorsByVote = true,
  useCursorSmoothing = true,
  disableCursorValence = false,
  disableBackgroundValence = false,
  debug = false,
  showShareButton = true,
  showPresenceCounter = true,
  showRecBadge = true,
  showDebugHint = true,
  showNowLabel = true,
  selfChain,
  shareUrl,
  currentReactionState,
  touchPos,
  touchDisabled = false,
  hideTouchLayer = false,
  touchImageUrl,
  topRightSlot,
  bannerSlot,
  canvasOverlay,
  backgroundOverlay,
  onSocketReady,
  onConnected,
  onRoomLabelsChange,
  onRoomAnchorsChange,
  onRoomImageUrlChange,
  onSocialConfigChange,
  onGreeterConfigChange,
  onOwnValenceDisplayChange,
  onValenceInputModeChange,
  onNowLabelChange,
  onInviteEdges,
  onConnectedUsers,
  onUserJoined,
  onUserLeft,
  onPresenceCount,
  onActiveCursorCountChange,
  onSimulatedCursorCountChange,
  onRecordingStateChange,
  onViewerCount,
  onConnectedAsViewer,
  onUserCapChanged,
  onJoinApproved,
  onActivityTriggered,
  onBackgroundColorChange,
  onTouchPosition,
}: ReactionCanvasParticipantProps) {
  // Internally-owned state, mirrored out via callbacks.
  const [serverLabels, setServerLabels] = useState<ReactionLabelSet | null>(null);
  const [serverAnchors, setServerAnchors] = useState<ReactionAnchors | null>(null);
  const [ownValenceDisplay, setOwnValenceDisplay] = useState<'background' | 'labels' | 'none'>('labels');
  const [presenceCount, setPresenceCount] = useState(0);
  const [activeCursorCount, setActiveCursorCount] = useState(0);
  const [simulatedCursorCount, setSimulatedCursorCount] = useState(0);
  const [viewerCount, setViewerCount] = useState(0);
  const [userCap, setUserCap] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [nowLabel, setNowLabel] = useState('');
  const reactionStateRef = useRef<ReactionState>(null);

  // Controlled-or-uncontrolled: null is a valid value, so gate on `=== undefined`.
  const [internalReaction, setInternalReaction] = useState<ReactionState>(null);
  const [internalTouchPos, setInternalTouchPos] = useState<{ x: number; y: number } | null>(null);
  const isReactionControlled = currentReactionState !== undefined;
  const isTouchPosControlled = touchPos !== undefined;
  const effectiveReaction = isReactionControlled ? currentReactionState : internalReaction;
  const effectiveTouchPos = isTouchPosControlled ? touchPos : internalTouchPos;

  // Derived
  const labels = labelsOverride !== undefined ? labelsOverride : (serverLabels ?? REACTION_LABEL_PRESETS.default);
  const anchors = serverAnchors ?? DEFAULT_ANCHORS;

  // Dual-callback handlers: update own state AND forward to the parent shell.
  const handleRoomLabels = (l: { positive: string; negative: string; neutral: string } | null) => {
    setServerLabels(l);
    onRoomLabelsChange?.(l);
  };
  const handleRoomAnchors = (a: ReactionAnchors | null) => {
    setServerAnchors(a);
    onRoomAnchorsChange?.(a);
  };
  const handleOwnValenceDisplay = (m: 'background' | 'labels' | 'none') => {
    setOwnValenceDisplay(m);
    onOwnValenceDisplayChange?.(m);
  };
  const handlePresence = (n: number) => { setPresenceCount(n); onPresenceCount?.(n); };
  const handleActiveCursor = (n: number) => { setActiveCursorCount(n); onActiveCursorCountChange?.(n); };
  const handleSimulatedCursor = (n: number) => { setSimulatedCursorCount(n); onSimulatedCursorCountChange?.(n); };
  const handleRecording = (b: boolean) => { setIsRecording(b); onRecordingStateChange?.(b); };
  const handleViewerCount = (n: number) => { setViewerCount(n); onViewerCount?.(n); };
  const handleConnectedAsViewer = (viewer: boolean, cap: number | null) => { setUserCap(cap); onConnectedAsViewer?.(viewer, cap); };
  const handleUserCap = (cap: number | null) => { setUserCap(cap); onUserCapChanged?.(cap); };
  const handleNowLabel = (label: string) => { setNowLabel(label); onNowLabelChange?.(label); };
  const handleBackgroundColor = (s: ReactionState) => {
    if (!isReactionControlled) setInternalReaction(s);
    onBackgroundColorChange?.(s);
  };
  const handleTouchPosition = (p: { x: number; y: number } | null) => {
    if (!isTouchPosControlled) setInternalTouchPos(p);
    onTouchPosition?.(p);
  };

  return (
    <>
      {backgroundOverlay}
      {labels && showLabels && (
        <div className="reaction-label reaction-label-positive" style={{ ...reactionLabelStyle(anchors.positive), ...(ownValenceDisplay === 'labels' && effectiveReaction === 'positive' ? { background: 'rgba(0, 255, 0, 0.2)' } : {}) }}>{labels.positive}</div>
      )}
      {labels && showLabels && (
        <div className="reaction-label reaction-label-negative" style={{ ...reactionLabelStyle(anchors.negative), ...(ownValenceDisplay === 'labels' && effectiveReaction === 'negative' ? { background: 'rgba(255, 0, 0, 0.2)' } : {}) }}>{labels.negative}</div>
      )}
      {labels && showLabels && (
        <div className="reaction-label reaction-label-neutral" style={{ ...reactionLabelStyle(anchors.neutral), ...(ownValenceDisplay === 'labels' && effectiveReaction === 'neutral' ? { background: 'rgba(255, 255, 0, 0.2)' } : {}) }}>{labels.neutral}</div>
      )}
      {bannerSlot}
      {showPresenceCounter && (
        <div className="v2-presence-counter">
          <span className="v2-counter-num">{presenceCount}</span>
          {userCap !== null && <span className="v2-counter-dim">/{userCap}</span>} here · <span className="v2-counter-num">{activeCursorCount - simulatedCursorCount + (effectiveTouchPos !== null ? 1 : 0)}</span> touching
          {simulatedCursorCount > 0 && <> · <span className="v2-counter-num">{simulatedCursorCount}</span> simulated</>}
          {viewerCount > 0 && <> · <span className="v2-counter-num">{viewerCount}</span> watching</>}
        </div>
      )}
      {showDebugHint && <div className="debug-hint">{debug ? 'd: debug on' : 'd: debug'}</div>}
      {showRecBadge && <div className={`v3-rec-badge${isRecording ? '' : ' v3-rec-badge--off'}`}>● REC</div>}
      {showShareButton && <ShareQRButton userId={userId} selfChain={selfChain} shareUrlOverride={shareUrl} />}
      {topRightSlot}
      {effectiveTouchPos && (
        <div className="v2-touch-indicator" style={{ left: effectiveTouchPos.x, top: effectiveTouchPos.y }} />
      )}
      <Canvas
        userId={userId}
        autoSize={autoSize}
        heightOffset={autoSize ? undefined : heightOffset}
        colorCursorsByVote={colorCursorsByVote}
        cursorSmoothingConfig={useCursorSmoothing && SMOOTH_CURSOR_ENABLED ? { ...SMOOTH_CURSOR_CONFIG, showSmoothCursor: true } : undefined}
        hideActualCursors={useCursorSmoothing && SMOOTH_CURSOR_ENABLED}
        disableCursorValence={disableCursorValence}
        disableBackgroundValence={disableBackgroundValence}
        currentReactionState={effectiveReaction}
        debug={debug}
        onOwnValenceDisplayChange={handleOwnValenceDisplay}
        onValenceInputModeChange={onValenceInputModeChange}
        onPresenceCount={handlePresence}
        onActiveCursorCountChange={handleActiveCursor}
        onSimulatedCursorCountChange={handleSimulatedCursor}
        onRecordingStateChange={handleRecording}
        onConnected={onConnected}
        onRoomLabelsChange={handleRoomLabels}
        onRoomAnchorsChange={handleRoomAnchors}
        onViewerCount={handleViewerCount}
        onConnectedAsViewer={handleConnectedAsViewer}
        onUserCapChanged={handleUserCap}
        onJoinApproved={onJoinApproved}
        onSocketReady={onSocketReady}
        onActivityTriggered={onActivityTriggered}
        onRoomImageUrlChange={onRoomImageUrlChange}
        onSocialConfigChange={onSocialConfigChange}
        onGreeterConfigChange={onGreeterConfigChange}
        onNowLabelChange={handleNowLabel}
        onInviteEdges={onInviteEdges}
        onConnectedUsers={onConnectedUsers}
        onUserJoined={onUserJoined}
        onUserLeft={onUserLeft}
      />
      {showNowLabel && nowLabel && (
        <div className="canvas-now-label" style={{ top: `calc(${anchors.positive.y}% + 60px)` }}>
          {nowLabel}
        </div>
      )}
      {canvasOverlay}
      {!hideTouchLayer && (
        <TouchLayer
          userId={userId}
          autoSize={autoSize}
          onReactionStateChange={() => {}}
          reactionStateRef={reactionStateRef}
          onBackgroundColorChange={handleBackgroundColor}
          onTouchPosition={handleTouchPosition}
          heightOffset={autoSize ? undefined : heightOffset}
          anchors={anchors}
          imageUrl={touchImageUrl}
          disabled={touchDisabled}
        />
      )}
    </>
  );
}
