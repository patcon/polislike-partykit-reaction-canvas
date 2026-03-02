import { useState, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import Canvas from "./Canvas";
import TouchLayer from "./TouchLayer";
import AdminPanelV4 from "./AdminPanelV4";
import { getReactionLabelSet } from "../voteLabels";

type VoteState = 'agree' | 'disagree' | 'pass' | null;

function getRoomParamFromUrl(): string {
  return new URLSearchParams(window.location.search).get('room') ?? 'default';
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

export default function ReactionCanvasAppV4() {
  const [userId] = useState(() => Math.random().toString(36).substr(2, 9));
  const [canvasBackgroundVoteState, setCanvasBackgroundVoteState] = useState<VoteState>(null);
  const [presenceCount, setPresenceCount] = useState<number>(0);
  const [touchPos, setTouchPos] = useState<{ x: number; y: number } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const voteStateRef = useRef<VoteState>(null);

  if (isAdminMode()) {
    const room = getRoomParamFromUrl();
    return <AdminPanelV4 room={room} />;
  }

  if (!isTouchDevice() && !isMobileForced()) {
    return <MobileOnlyGate />;
  }

  const room = getRoomParamFromUrl();
  const labels = getReactionLabelSet(getLabelsParamFromUrl());

  return (
    <div className="v2-app-container">
      <div className="v2-vote-canvas-container" style={{ flex: 1 }}>
        <div className="vote-label vote-label-agree">{labels.agree}</div>
        <div className="vote-label vote-label-disagree">{labels.disagree}</div>
        <div className="vote-label vote-label-pass">{labels.pass}</div>
        <div className="v2-presence-counter">{presenceCount} here</div>
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
          currentVoteState={canvasBackgroundVoteState}
          heightOffset={0}
          onPresenceCount={setPresenceCount}
          onRecordingStateChange={setIsRecording}
        />
        <TouchLayer
          room={room}
          userId={userId}
          onActiveStatementChange={() => {}}
          onVoteStateChange={() => {}}
          voteStateRef={voteStateRef}
          onBackgroundColorChange={setCanvasBackgroundVoteState}
          onTouchPosition={setTouchPos}
          heightOffset={0}
        />
      </div>
    </div>
  );
}
