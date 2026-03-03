import { useState, useRef, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import Canvas from "./Canvas";
import TouchLayer from "./TouchLayer";
import AdminPanelV3 from "./AdminPanelV3";
import { getReactionLabelSet } from "../voteLabels";
import { DEFAULT_ANCHORS, reactionLabelStyle } from "../utils/voteRegion";

type ReactionState = 'positive' | 'negative' | 'neutral' | null;

function getRoomParamFromUrl(): string {
  const p = new URLSearchParams(window.location.search);
  return p.get('room') ?? p.get('videoId') ?? 'default';
}

function getLabelsParamFromUrl(): string | undefined {
  return new URLSearchParams(window.location.search).get('labels') ?? undefined;
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

function MobileOnlyGate() {
  const url = window.location.href;
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
    </div>
  );
}

export default function ReactionCanvasAppV3() {
  const [userId] = useState(() => Math.random().toString(36).substr(2, 9));
  const [canvasBackgroundReactionState, setCanvasBackgroundReactionState] = useState<ReactionState>(null);
  const [presenceCount, setPresenceCount] = useState<number>(0);
  const [activeCursorCount, setActiveCursorCount] = useState<number>(0);
  const [touchPos, setTouchPos] = useState<{ x: number; y: number } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [debug, setDebug] = useState(false);
  const reactionStateRef = useRef<ReactionState>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'd') setDebug(prev => !prev);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (isAdminMode()) {
    const room = getRoomParamFromUrl();
    return <AdminPanelV3 room={room} />;
  }

  if (!isTouchDevice() && !isMobileForced()) {
    return <MobileOnlyGate />;
  }

  const room = getRoomParamFromUrl();
  const labels = getReactionLabelSet(getLabelsParamFromUrl());

  return (
    <div className="v2-app-container">
      <div className="v2-vote-canvas-container" style={{ flex: 1 }}>
        {labels && <div className="reaction-label reaction-label-positive" style={reactionLabelStyle(DEFAULT_ANCHORS.positive)}>{labels.positive}</div>}
        {labels && <div className="reaction-label reaction-label-negative" style={reactionLabelStyle(DEFAULT_ANCHORS.negative)}>{labels.negative}</div>}
        {labels && <div className="reaction-label reaction-label-neutral" style={reactionLabelStyle(DEFAULT_ANCHORS.neutral)}>{labels.neutral}</div>}
        <div className="v2-presence-counter">
          <span className="v2-counter-num">{presenceCount}</span> here · <span className="v2-counter-num">{activeCursorCount + (touchPos !== null ? 1 : 0)}</span> touching
        </div>
        <div className="debug-hint">{debug ? 'd: debug on' : 'd: debug'}</div>
        {isRecording && <div className="v3-rec-badge">● REC</div>}
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
          onRecordingStateChange={setIsRecording}
          debug={debug}
        />
        <TouchLayer
          room={room}
          userId={userId}
          onActiveStatementChange={() => {}}
          onReactionStateChange={() => {}}
          reactionStateRef={reactionStateRef}
          onBackgroundColorChange={setCanvasBackgroundReactionState}
          onTouchPosition={setTouchPos}
          heightOffset={0}
        />
      </div>
    </div>
  );
}
