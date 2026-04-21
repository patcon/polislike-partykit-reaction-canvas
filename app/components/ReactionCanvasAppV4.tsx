import { useState, useRef, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import Canvas from "./Canvas";
import TouchLayer from "./TouchLayer";
import AdminPanelV4 from "./AdminPanelV4";
import InterfaceChipBar from "./InterfaceChipBar";
import SocialPanel from "./SocialPanel";
import type { SocialConfig } from "../types";
import GithubUsernameModal from "./GithubUsernameModal";
import InterfacePushModal from "./InterfacePushModal";
import { DEFAULT_ANCHORS, reactionLabelStyle } from "../utils/voteRegion";
import type { ReactionAnchors } from "../utils/voteRegion";
import { getReactionLabelSet } from "../voteLabels";
import type { ReactionLabelSet } from "../voteLabels";
import { getPersistentUserId } from "../utils/userId";
import ShareQRButton from "./ShareQRButton";

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

const CHIP_BAR_HEIGHT = 40;

// Redirect deprecated ?admin=true to canonical ?interface=emcee
(function redirectDeprecatedAdminParam() {
  const p = new URLSearchParams(window.location.search);
  if (p.get('admin') === 'true') {
    p.delete('admin');
    p.set('interface', 'emcee');
    history.replaceState(null, '', `?${p}${window.location.hash}`);
  }
})();

function getUnlockedInterfaces(): string[] {
  const p = new URLSearchParams(window.location.search);
  const interfaces = ['canvas'];
  if (p.get('interface') === 'emcee') interfaces.push('emcee');
  if (p.get('interface') === 'social') interfaces.push('social');
  return interfaces;
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
  const [unlockedInterfaces] = useState(() => getUnlockedInterfaces());
  const [activeInterface, setActiveInterface] = useState(() => {
    const unlocked = getUnlockedInterfaces();
    const saved = localStorage.getItem('v4-active-interface');
    if (saved && unlocked.includes(saved)) return saved;
    return unlocked.includes('emcee') ? 'emcee' : 'canvas';
  });
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
  const [serverImageUrl, setServerImageUrl] = useState('');
  const [serverSocialConfig, setServerSocialConfig] = useState<SocialConfig | null>(null);
  const [activity, setActivity] = useState<'canvas' | 'soccer' | 'image-canvas'>('canvas');
  const [debug, setDebug] = useState(() => new URLSearchParams(window.location.search).get('debug') === '1');
  const reactionStateRef = useRef<ReactionState>(null);
  const [showGithubModal, setShowGithubModal] = useState(false);
  const [pushedInterface, setPushedInterface] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('v4-active-interface', activeInterface);
  }, [activeInterface]);

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

  const isEmcee = unlockedInterfaces.includes('emcee');

  if (!isEmcee && !isTouchDevice() && !isMobileForced()) {
    return <MobileOnlyGate />;
  }

  const room = getRoomParamFromUrl();
  const anchors = serverAnchors ?? DEFAULT_ANCHORS;
  // URL param overrides server; server overrides default; null = admin explicitly hid labels
  const urlLabelParam = getLabelsParamFromUrl();
  const labels = urlLabelParam ? getReactionLabelSet(urlLabelParam) : serverLabels;

  const showChipBar = unlockedInterfaces.length >= 2;
  const chipBarOffset = showChipBar ? CHIP_BAR_HEIGHT : 0;
  const INTERFACE_CHIPS = [
    { key: 'canvas', label: 'Canvas' },
    { key: 'emcee', label: 'Emcee' },
    { key: 'social', label: 'Social' },
  ];

  return (
    <div className="v2-app-container">
      {showChipBar && (
        <InterfaceChipBar
          interfaces={INTERFACE_CHIPS.filter(c => unlockedInterfaces.includes(c.key))}
          active={activeInterface}
          onSelect={setActiveInterface}
        />
      )}
      {activeInterface === 'emcee' ? (
        <AdminPanelV4 room={room} />
      ) : activeInterface === 'social' ? (
        <SocialPanel socialConfig={serverSocialConfig} />
      ) : null}
      {/* Canvas is always mounted to keep the WebSocket alive for all interfaces */}
      <div className="v2-vote-canvas-container" style={{ flex: 1, display: activeInterface === 'canvas' ? undefined : 'none' }}>
          {activity === 'image-canvas' && serverImageUrl && (
            <img
              src={serverImageUrl}
              className="image-canvas-bg"
              alt=""
            />
          )}
          {labels && activity === 'canvas' && <div className="reaction-label reaction-label-positive" style={reactionLabelStyle(anchors.positive)}>{labels.positive}</div>}
          {labels && activity === 'canvas' && <div className="reaction-label reaction-label-negative" style={reactionLabelStyle(anchors.negative)}>{labels.negative}</div>}
          {labels && activity === 'canvas' && <div className="reaction-label reaction-label-neutral" style={reactionLabelStyle(anchors.neutral)}>{labels.neutral}</div>}
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
          <ShareQRButton />
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
            heightOffset={chipBarOffset}
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
            onInterfacePushed={(name) => setPushedInterface(name)}
            onRoomImageUrlChange={setServerImageUrl}
            onActivityChange={setActivity}
            onSocialConfigChange={setServerSocialConfig}
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
              heightOffset={chipBarOffset}
              anchors={anchors}
              imageUrl={serverImageUrl || undefined}
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
          {pushedInterface && (
            <InterfacePushModal
              interfaceName={pushedInterface}
              onAccept={() => {
                socketSendRef.current?.(JSON.stringify({ type: 'acceptInterface', interfaceName: pushedInterface }));
                setPushedInterface(null);
              }}
              onDecline={() => setPushedInterface(null)}
            />
          )}
        </div>
    </div>
  );
}
