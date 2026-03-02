import { useState, useRef, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import Canvas from "./Canvas";
import TouchLayer from "./TouchLayer";
import AdminPanelV4 from "./AdminPanelV4";
import { getReactionLabelSet, REACTION_LABEL_PRESETS, encodeCustomLabels, decodeCustomLabels } from "../voteLabels";

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

const PRESET_KEYS = Object.keys(REACTION_LABEL_PRESETS);

function isCustomKey(key: string): boolean {
  return key !== '' && key !== 'none' && !PRESET_KEYS.includes(key);
}

function HelpModal({ onClose }: { onClose: () => void }) {
  const currentKey = getCurrentLabelsParam();
  const startCustom = isCustomKey(currentKey);
  const decodedCustom = startCustom ? decodeCustomLabels(currentKey) : null;

  const [selected, setSelected] = useState(startCustom ? 'custom' : currentKey);
  const [customAgree, setCustomAgree] = useState(decodedCustom?.agree ?? '');
  const [customDisagree, setCustomDisagree] = useState(decodedCustom?.disagree ?? '');
  const [customPass, setCustomPass] = useState(decodedCustom?.pass ?? '');

  const labelKeyForUrl = selected === 'custom'
    ? (customAgree && customDisagree && customPass ? encodeCustomLabels(customAgree, customDisagree, customPass) : '')
    : selected;
  const linkHref = labelKeyForUrl ? buildUrlWithLabels(labelKeyForUrl) : undefined;

  return (
    <div className="v4-help-modal-overlay" onClick={onClose}>
      <div className="v4-help-modal" onClick={e => e.stopPropagation()}>
        <h2>Settings</h2>

        <div className="v4-help-modal-section">
          <label>Reaction labels</label>
          <div className="v4-help-modal-radios">
            {Object.entries(REACTION_LABEL_PRESETS).map(([key, set]) => (
              <div key={key} className="v4-help-modal-option">
                <label>
                  <input
                    type="radio"
                    name="labels"
                    value={key}
                    checked={selected === key}
                    onChange={() => setSelected(key)}
                  />
                  {set.agree} / {set.disagree} / {set.pass}
                </label>
                {set.hint && (
                  <p className="v4-help-modal-hint">
                    {set.hint}
                    {set.hintLinkText && set.hintUrl && (
                      <a href={set.hintUrl} target="_blank" rel="noopener noreferrer">{set.hintLinkText}</a>
                    )}
                  </p>
                )}
              </div>
            ))}

            <div className="v4-help-modal-option">
              <label>
                <input
                  type="radio"
                  name="labels"
                  value="custom"
                  checked={selected === 'custom'}
                  onChange={() => setSelected('custom')}
                />
                Custom
              </label>
              {selected === 'custom' && (
                <div className="v4-help-modal-custom-inputs">
                  {[
                    ['Agree', customAgree, setCustomAgree],
                    ['Disagree', customDisagree, setCustomDisagree],
                    ['Pass', customPass, setCustomPass],
                  ].map(([slot, val, setter]) => (
                    <div key={slot as string} className="v4-help-modal-custom-row">
                      <span>{slot as string}</span>
                      <input
                        type="text"
                        value={val as string}
                        onChange={e => (setter as (v: string) => void)(e.target.value)}
                        placeholder={`${slot} label`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="v4-help-modal-option">
              <label>
                <input
                  type="radio"
                  name="labels"
                  value="none"
                  checked={selected === 'none'}
                  onChange={() => setSelected('none')}
                />
                None (labels hidden)
              </label>
            </div>
          </div>
        </div>

        {linkHref
          ? <a className="v4-help-modal-link" href={linkHref}>Apply &amp; reload →</a>
          : <span className="v4-help-modal-link v4-help-modal-link-disabled">Apply &amp; reload →</span>
        }
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
