import { useState, useRef, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import Canvas from "./Canvas";
import TouchLayer from "./TouchLayer";
import AdminPanelV4 from "./AdminPanelV4";
import { getReactionLabelSet, REACTION_LABEL_PRESETS } from "../voteLabels";

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

function buildUrlWithLabels(labelKey: string): string {
  const url = new URL(window.location.href);
  url.searchParams.set('labels', labelKey);
  return url.toString();
}

function getCurrentLabelsParam(): string {
  return new URLSearchParams(window.location.search).get('labels') ?? 'default';
}

function HelpModal({ onClose }: { onClose: () => void }) {
  const [selectedLabels, setSelectedLabels] = useState(getCurrentLabelsParam());
  const linkHref = buildUrlWithLabels(selectedLabels);

  return (
    <div className="v4-help-modal-overlay" onClick={onClose}>
      <div className="v4-help-modal" onClick={e => e.stopPropagation()}>
        <h2>Settings</h2>

        <div className="v4-help-modal-section">
          <label>Reaction labels</label>
          <div className="v4-help-modal-radios">
            {Object.entries(REACTION_LABEL_PRESETS).map(([key, set]) => (
              <label key={key}>
                <input
                  type="radio"
                  name="labels"
                  value={key}
                  checked={selectedLabels === key}
                  onChange={() => setSelectedLabels(key)}
                />
                {set.agree} / {set.disagree} / {set.pass}
              </label>
            ))}
            <label key="none">
              <input
                type="radio"
                name="labels"
                value="none"
                checked={selectedLabels === 'none'}
                onChange={() => setSelectedLabels('none')}
              />
              None (labels hidden)
            </label>
          </div>
        </div>

        <a className="v4-help-modal-link" href={linkHref}>Apply &amp; reload →</a>
        <p className="v4-help-modal-close">Press <kbd>?</kbd> or click outside to close</p>
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
  const [helpOpen, setHelpOpen] = useState(false);
  const voteStateRef = useRef<VoteState>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '?') setHelpOpen(prev => !prev);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

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
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      <div className="v2-vote-canvas-container" style={{ flex: 1 }}>
        {labels && <div className="vote-label vote-label-agree">{labels.agree}</div>}
        {labels && <div className="vote-label vote-label-disagree">{labels.disagree}</div>}
        {labels && <div className="vote-label vote-label-pass">{labels.pass}</div>}
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
