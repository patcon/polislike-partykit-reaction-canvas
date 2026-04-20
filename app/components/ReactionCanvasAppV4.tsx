import { useState, useRef, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import Canvas from "./Canvas";
import TouchLayer from "./TouchLayer";
import AdminPanelV4 from "./AdminPanelV4";
import GithubUsernameModal from "./GithubUsernameModal";
import { DEFAULT_ANCHORS, reactionLabelStyle } from "../utils/voteRegion";
import type { ReactionAnchors } from "../utils/voteRegion";
import { getReactionLabelSet } from "../voteLabels";
import type { ReactionLabelSet } from "../voteLabels";
import { getPersistentUserId } from "../utils/userId";

type ReactionState = 'positive' | 'negative' | 'neutral' | null;

function getRoomParamFromUrl(): string {
  const p = new URLSearchParams(window.location.search);
  return p.get('room') ?? p.get('videoId') ?? 'default';
}

function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

function isMobileForced(): boolean {
  return new URLSearchParams(window.location.search).get('forceView') === 'mobile';
}

function isAdminMode(): boolean {
  return new URLSearchParams(window.location.search).get('admin') === 'true';
}

function getLabelsParamFromUrl(): string | undefined {
  return new URLSearchParams(window.location.search).get('labels') ?? undefined;
}

function MobileOnlyGate() {
  const url = window.location.href;
  const bypassHref = (() => { const p = new URLSearchParams(window.location.search); p.set('forceView', 'mobile'); return `?${p}${window.location.hash}`; })();
  return (
    <div className="v2-mobile-gate">
      <div className="v2-mobile-gate-content">
        <p className="v2-mobile-gate-message">This experience is designed for mobile touch devices.</p>
        <p className="v2-mobile-gate-sub">Scan the QR code on your phone to open this page:</p>
        <div className="v2-mobile-gate-qr">
          <QRCodeSVG value={url} size={220} />
        </div>
        <p className="v2-mobile-gate-url">{url}</p>
      </div>
      <a href={bypassHref} className="v2-mobile-gate-bypass">bypass</a>
    </div>
  );
}

export default function ReactionCanvasAppV4() {
  const [userId] = useState(() => getPersistentUserId());
  const [canvasBackgroundReactionState, setCanvasBackgroundReactionState] = useState<ReactionState>(null);
  const [presenceCount, setPresenceCount] = useState<number>(0);
  const [activeCursorCount, setActiveCursorCount] = useState<number>(0);
  const [simulatedCursorCount, setSimulatedCursorCount] = useState<number>(0);
  const [isViewer, setIsViewer] = useState(false);
  const [userCap, setUserCap] = useState<number | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const socketSendRef = useRef<((msg: string) => void) | null>(null);
  const [touchPos, setTouchPos] = useState<{ x: number; y: number } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [serverLabels, setServerLabels] = useState<ReactionLabelSet | null>(null);
  const [serverAnchors, setServerAnchors] = useState<ReactionAnchors | null>(null);
  const [debug, setDebug] = useState(() => new URLSearchParams(window.location.search).get('debug') === '1');
  const reactionStateRef = useRef<ReactionState>(null);
  const [showGithubModal, setShowGithubModal] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'd') setDebug(prev => !prev);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const roomHasSpace = userCap === null || presenceCount < userCap;

  const handleJoinRequest = () => {
    socketSendRef.current?.(JSON.stringify({ type: 'requestJoin' }));
  };

  if (isAdminMode()) {
    const room = getRoomParamFromUrl();
    return <AdminPanelV4 room={room} />;
  }

  if (!isTouchDevice() && !isMobileForced()) {
    return <MobileOnlyGate />;
  }

  const room = getRoomParamFromUrl();
  const anchors = serverAnchors ?? DEFAULT_ANCHORS;
  // URL param overrides server; server overrides default; null = admin explicitly hid labels
  const urlLabelParam = getLabelsParamFromUrl();
  const labels = urlLabelParam ? getReactionLabelSet(urlLabelParam) : serverLabels;

  return (
    <div className="v2-app-container">
      <div className="v2-vote-canvas-container" style={{ flex: 1 }}>
        {labels && <div className="reaction-label reaction-label-positive" style={reactionLabelStyle(anchors.positive)}>{labels.positive}</div>}
        {labels && <div className="reaction-label reaction-label-negative" style={reactionLabelStyle(anchors.negative)}>{labels.negative}</div>}
        {labels && <div className="reaction-label reaction-label-neutral" style={reactionLabelStyle(anchors.neutral)}>{labels.neutral}</div>}
        {isViewer && (
          <div className="viewer-mode-banner">
            This room is full — you are watching in view-only mode.
            {roomHasSpace && (
              <button className="viewer-join-btn" onClick={handleJoinRequest}>Join</button>
            )}
          </div>
        )}
        <div className="v2-presence-counter">
          <span className="v2-counter-num">{presenceCount}</span>
          {userCap !== null && <span className="v2-counter-dim">/{userCap}</span>} here · <span className="v2-counter-num">{activeCursorCount - simulatedCursorCount + (touchPos !== null ? 1 : 0)}</span> touching
          {simulatedCursorCount > 0 && <> · <span className="v2-counter-num">{simulatedCursorCount}</span> simulated</>}
          {viewerCount > 0 && <> · <span className="v2-counter-num">{viewerCount}</span> watching</>}
        </div>
        <div className="debug-hint">{debug ? 'd: debug on' : 'd: debug'}</div>
        <div className={`v3-rec-badge${isRecording ? '' : ' v3-rec-badge--off'}`}>● REC</div>
        {touchPos && (
          <div
            className="v2-touch-indicator"
            style={{ left: touchPos.x, top: touchPos.y }}
          />
        )}
        <Canvas
          room={room}
          userId={userId}
          colorCursorsByVote={true}
          currentReactionState={canvasBackgroundReactionState}
          heightOffset={0}
          onPresenceCount={setPresenceCount}
          onActiveCursorCountChange={setActiveCursorCount}
          onSimulatedCursorCountChange={setSimulatedCursorCount}
          onRecordingStateChange={setIsRecording}
          onRoomLabelsChange={setServerLabels}
          onRoomAnchorsChange={setServerAnchors}
          onViewerCount={setViewerCount}
          onConnectedAsViewer={(viewer, cap) => { setIsViewer(viewer); setUserCap(cap); }}
          onUserCapChanged={setUserCap}
          onJoinApproved={() => setIsViewer(false)}
          onSocketReady={(send) => { socketSendRef.current = send; }}
          onActivityTriggered={(activityName) => {
            if (activityName === 'githubUsername') setShowGithubModal(true);
          }}
          debug={debug}
        />
        {!isViewer && (
          <TouchLayer
            room={room}
            userId={userId}
            onActiveStatementChange={() => {}}
            onReactionStateChange={() => {}}
            reactionStateRef={reactionStateRef}
            onBackgroundColorChange={setCanvasBackgroundReactionState}
            onTouchPosition={setTouchPos}
            heightOffset={0}
            anchors={anchors}
          />
        )}
        {showGithubModal && (
          <GithubUsernameModal
            onSubmit={(username, displayName, avatarUrl) => {
              socketSendRef.current?.(JSON.stringify({
                type: 'submitGithubUsername',
                username,
                displayName,
                avatarUrl,
                timestamp: Date.now(),
              }));
            }}
            onDismiss={() => setShowGithubModal(false)}
          />
        )}
      </div>
    </div>
  );
}
