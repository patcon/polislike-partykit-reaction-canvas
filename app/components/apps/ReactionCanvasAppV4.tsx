import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Canvas from "../shared/Canvas";
import TouchLayer from "../shared/TouchLayer";
import SignatureLayer from "../canvas/SignatureLayer";
import SignatureCanvas from "../canvas/SignatureCanvas";
import AdminPanelNoDB from "../panels/AdminPanelNoDB";
import InterfaceChipBar from "../shared/InterfaceChipBar";
import SocialMediaPanel from "../panels/SocialMediaPanel";
import MoodTonesPanel from "../panels/MoodTonesPanel";
import GreeterPanel from "../panels/GreeterPanel";
import type { ActivityMode, GreeterConfig, MapViewerConfig, SocialConfig, ValenceInputMode } from "../../types";
import { PANEL_REGISTRY, SOLO_SCREEN_LABEL } from "../../panelRegistry";
import type { PanelDefinition } from "../../panelRegistry";
import { PanelContextProvider } from "../../context/PanelContext";
import { GreeterConfigProvider, SocialMediaConfigProvider, MapViewerConfigProvider } from "../../context/PanelConfigs";
import GithubUsernameModal from "../modals/GithubUsernameModal";
import FeedbackStarsModal from "../modals/FeedbackStarsModal";
import InterfacePushModal from "../modals/InterfacePushModal";
import HapticPushModal from "../modals/HapticPushModal";
import { WebHaptics } from "web-haptics";
import { useWebHaptics } from "web-haptics/react";
import { DEFAULT_ANCHORS, reactionLabelStyle, valenceToPosition, computeReactionRegion } from "../../utils/voteRegion";
import type { ReactionAnchors } from "../../utils/voteRegion";
import { getReactionLabelSet } from "../../voteLabels";
import type { ReactionLabelSet } from "../../voteLabels";
import { getPersistentUserId } from "../../utils/userId";
import ShareQRButton from "../shared/ShareQRButton";
import QRWithCopy from "../shared/QRWithCopy";
import { parseInviteChain, appendSelfToChain, chainToEdges, storeChain, getStoredChain } from "../../utils/inviteChain";
import HapticIndicatorButton from "../shared/HapticIndicatorButton";
import { useHapticPriming } from "../../hooks/useHapticPriming";
import WakeLockIndicatorButton from "../shared/WakeLockIndicatorButton";
import { useWakeLock } from "../../utils/useWakeLock";
import TreevitesPanel from "../panels/TreevitesPanel";
import StenoPanel from "../panels/StenoPanel";
import StoryTracerPanel from "../panels/StoryTracerPanel";
import VoiceCallPanel from "../panels/VoiceCallPanel";
import MapMakerPanel from "../panels/MapMakerPanel";
import MapViewerPanel from "../panels/MapViewerPanel";
import ValenceBeatPadPanel from "../panels/ValenceBeatPadPanel";
import ArrivalCanvasPanel from "../panels/ArrivalCanvasPanel";
import NeighborPanel from "../panels/NeighborPanel";
import { SMOOTH_CURSOR_ENABLED, SMOOTH_CURSOR_CONFIG } from "../../utils/cursor";

const PANEL_COMPONENTS: Partial<Record<string, PanelDefinition['component']>> = {
  'social-sharing': SocialMediaPanel,
  'mood-tones':    MoodTonesPanel,
  treevites:       TreevitesPanel,
  greeter:         GreeterPanel,
  steno:           StenoPanel,
  'story-tracer':  StoryTracerPanel,
  'voice-call':    VoiceCallPanel,
  'map-maker':     MapMakerPanel,
  'map-viewer':      MapViewerPanel,
  'valence-beat-pad': ValenceBeatPadPanel,
  'arrival-canvas':   ArrivalCanvasPanel,
  'neighbor':         NeighborPanel,
};

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

const PUSHED_INTERFACES_KEY = 'v4-pushed-interfaces';

// Process ?addInterface=X: add to localStorage, force ?interface= to X, strip addInterface from URL
(function processAddInterfaceParam() {
  const p = new URLSearchParams(window.location.search);
  const toAdd = p.get('addInterface');
  if (!toAdd) return;
  try {
    const stored: string[] = JSON.parse(localStorage.getItem(PUSHED_INTERFACES_KEY) ?? '[]');
    if (!stored.includes(toAdd)) {
      localStorage.setItem(PUSHED_INTERFACES_KEY, JSON.stringify([...stored, toAdd]));
    }
  } catch { /* ignore */ }
  p.delete('addInterface');
  p.set('interface', toAdd);
  history.replaceState(null, '', `?${p}${window.location.hash}`);
})();

function getUnlockedInterfaces(): string[] {
  const p = new URLSearchParams(window.location.search);
  const interfaces = ['canvas'];
  // Only emcee is URL-privileged; all other patchable interfaces unlock via ?addInterface= (localStorage-backed)
  if (p.get('interface') === 'emcee') interfaces.push('emcee');
  try {
    const stored = JSON.parse(localStorage.getItem(PUSHED_INTERFACES_KEY) ?? '[]');
    if (Array.isArray(stored)) {
      for (const key of stored) {
        if (typeof key === 'string' && !interfaces.includes(key)) interfaces.push(key);
      }
    }
  } catch { /* ignore */ }
  return interfaces;
}

function getLabelsParamFromUrl(): string | undefined {
  return new URLSearchParams(window.location.search).get('labels') ?? undefined;
}

function getCustomPhotoFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get('customPhoto');
}


function MobileOnlyGate() {
  const url = window.location.href;
  const bypassHref = (() => { const p = new URLSearchParams(window.location.search); p.set('forceView', 'mobile'); return `?${p}${window.location.hash}`; })();
  return (
    <div className="v2-mobile-gate">
      <div className="v2-mobile-gate-content">
        <p className="v2-mobile-gate-message">This experience is designed for mobile touch devices.</p>
        <p className="v2-mobile-gate-sub">Scan the QR code on your phone to open this page:</p>
        <QRWithCopy url={url} urlClassName="v2-mobile-gate-url" />
      </div>
      <a href={bypassHref} className="v2-mobile-gate-bypass">bypass</a>
    </div>
  );
}

export default function ReactionCanvasAppV4() {
  const [unlockedInterfaces, setUnlockedInterfaces] = useState(() => getUnlockedInterfaces());
  const [activeInterface, setActiveInterface] = useState(() => {
    const unlocked = getUnlockedInterfaces();
    const p = new URLSearchParams(window.location.search);
    const fromUrl = p.get('interface');
    if (fromUrl && unlocked.includes(fromUrl)) return fromUrl;
    const saved = localStorage.getItem('v4-active-interface');
    if (saved && unlocked.includes(saved)) return saved;
    return unlocked.includes('emcee') ? 'emcee' : 'canvas';
  });
  const [userId] = useState(() => getPersistentUserId());
  const [selfChain] = useState<string[]>(() => {
    const room = getRoomParamFromUrl();
    const urlChain = parseInviteChain(window.location.search);
    const storedChain = getStoredChain(room);
    // Stored chain takes priority — once a parent is established, rescanning
    // a different QR must not reassign parentage (would corrupt the tree on
    // server restart, since localStorage is the rebuild source of truth).
    const chain = storedChain.length > 0 ? storedChain : urlChain;
    if (chain.length > 0 && storedChain.length === 0) storeChain(room, chain);
    if (urlChain.length > 0) {
      const p = new URLSearchParams(window.location.search);
      p.delete('inviteChain');
      const qs = p.toString();
      window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`);
    }
    return chain;
  });
  const [inviteEdges, setInviteEdges] = useState<Record<string, string>>({});
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
  const [serverGreeterConfig, setServerGreeterConfig] = useState<GreeterConfig | null>(null);
  const [mapViewerConfig, setMapViewerConfig] = useState<MapViewerConfig | null>(null);
  const [nowLabel, setNowLabel] = useState('');
  const [activity, setActivity] = useState<ActivityMode>('canvas');
  const [ownValenceDisplay, setOwnValenceDisplay] = useState<'background' | 'labels' | 'none'>('labels');
  const [valenceInputMode, setValenceInputMode] = useState<ValenceInputMode>('touch');
  const [orientationPermission, setOrientationPermission] = useState<'unknown' | 'granted' | 'denied' | 'not-required'>('unknown');
  const [isPresenter, setIsPresenter] = useState(false);
  const [signatureStrokes, setSignatureStrokes] = useState<Record<string, Array<{ strokeId: string; points: Array<{ x: number; y: number }> }>>>({});
  const [connectedUserIds, setConnectedUserIds] = useState<string[]>([]);
  const [debug, setDebug] = useState(() => new URLSearchParams(window.location.search).get('debug') === '1');
  const reactionStateRef = useRef<ReactionState>(null);
  const [showGithubModal, setShowGithubModal] = useState(false);
  const [showFeedbackStarsModal, setShowFeedbackStarsModal] = useState(false);
  const [pushedInterface, setPushedInterface] = useState<string | null>(null);
  const [hapticPending, setHapticPending] = useState(false);
  const [suppressHapticModal, setSuppressHapticModal] = useState(
    () => localStorage.getItem('v4-suppress-haptic-modal') !== 'false'
  );
  const { hapticEnabled, effectivelyEnabled: hapticEffectivelyEnabled, onPointerDown: hapticOnPointerDown, onToggle: hapticOnToggle } = useHapticPriming();
  const [hapticFlashing, setHapticFlashing] = useState(false);
  const hapticFlashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasConnectedRef = useRef(false);
  const { trigger: triggerHaptic } = useWebHaptics();
  const [wakeLockEnabled, setWakeLockEnabled] = useState(false);

  // Derived early so useCallback deps below can reference it (must still be before any early return)
  const isEmcee = unlockedInterfaces.includes('emcee');
  const isOrientationMode = valenceInputMode !== 'touch';

  const triggerBuzzForUpdate = useCallback(() => {
    if (hapticFlashTimeoutRef.current) clearTimeout(hapticFlashTimeoutRef.current);
    setHapticFlashing(true);
    hapticFlashTimeoutRef.current = setTimeout(() => setHapticFlashing(false), 500);
    if (hapticEnabled && WebHaptics.isSupported) {
      triggerHaptic('nudge');
    } else if (!WebHaptics.isSupported && !suppressHapticModal) {
      setHapticPending(true);
    }
  }, [hapticEnabled, suppressHapticModal, triggerHaptic]);

  const handleRoomLabelsChange = useCallback((labels: ReactionLabelSet | null) => {
    if (hasConnectedRef.current && !isEmcee) triggerBuzzForUpdate();
    setServerLabels(labels);
  }, [isEmcee, triggerBuzzForUpdate]);

  const handleActivityChange = useCallback((act: ActivityMode) => {
    if (hasConnectedRef.current && !isEmcee) triggerBuzzForUpdate();
    setActivity(act);
  }, [isEmcee, triggerBuzzForUpdate]);

  const handleRoomImageUrlChange = useCallback((url: string) => {
    if (hasConnectedRef.current && !isEmcee) triggerBuzzForUpdate();
    setServerImageUrl(url);
  }, [isEmcee, triggerBuzzForUpdate]);

  useEffect(() => {
    localStorage.setItem('v4-active-interface', activeInterface);
    const p = new URLSearchParams(window.location.search);
    p.set('interface', activeInterface);
    const qs = p.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`);
  }, [activeInterface]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'd') setDebug(prev => !prev);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const { acquired: wakeLockAcquired } = useWakeLock(wakeLockEnabled && isOrientationMode);

  // Reset the user toggle when switching away from orientation mode
  useEffect(() => {
    if (!isOrientationMode) setWakeLockEnabled(false);
  }, [isOrientationMode]);

  const requestOrientationPermission = useCallback(async () => {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === 'function') {
      const result = await (DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission();
      setOrientationPermission(result === 'granted' ? 'granted' : 'denied');
    } else {
      setOrientationPermission('not-required');
    }
  }, []);

  // When switching away from orientation mode, clear the cursor and touch indicator.
  useEffect(() => {
    if (valenceInputMode === 'touch') {
      socketSendRef.current?.(JSON.stringify({
        type: 'remove',
        position: { x: 0, y: 0, timestamp: Date.now(), userId },
      }));
      setCanvasBackgroundReactionState(null);
      setTouchPos(null);
    }
  }, [valenceInputMode]);

  // Initialise permission state when entering an orientation mode.
  useEffect(() => {
    if (valenceInputMode === 'touch') return;
    // Chrome 74+ blocks DeviceOrientationEvent on non-secure (non-HTTPS, non-localhost) pages.
    if (!window.isSecureContext) {
      setOrientationPermission('denied');
      return;
    }
    if (typeof DeviceOrientationEvent === 'undefined') {
      setOrientationPermission('not-required');
      return;
    }
    if (typeof (DeviceOrientationEvent as unknown as { requestPermission?: unknown }).requestPermission !== 'function') {
      // Non-iOS: no explicit permission needed.
      setOrientationPermission('not-required');
    }
    // iOS: leave as 'unknown' so the permission banner is shown.
  }, [valenceInputMode]);

  const anchorsRef = useRef(serverAnchors ?? DEFAULT_ANCHORS);
  anchorsRef.current = serverAnchors ?? DEFAULT_ANCHORS;

  // Orientation → cursor send loop.
  useEffect(() => {
    if (valenceInputMode === 'touch') return;
    if (orientationPermission !== 'granted' && orientationPermission !== 'not-required') return;

    let lastSent = 0;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.beta === null || e.gamma === null) return;
      let rawValence: number;
      if (valenceInputMode === 'orientation-horizontal') {
        // Face-up = +1, edge-on (any axis) = 0, face-down = -1.
        // cos(β)·cos(γ) is the z-component of the screen normal in world space —
        // mathematically correct for any combination of forward/sideways tilt.
        rawValence = Math.cos(e.beta * Math.PI / 180) * Math.cos(e.gamma * Math.PI / 180);
      } else if (valenceInputMode === 'orientation-rotation') {
        // Steering wheel relative to landscape: landscape = 0 (pass), rotate CW toward upside-down portrait = +1, CCW toward portrait = -1.
        // cos(atan2(gamma, beta)) gives the correct quadrant-aware mapping through the full rotation.
        rawValence = Math.cos(Math.atan2(e.gamma, e.beta));
      } else {
        // Vertical: phone upright = +1, flat = 0, upside-down = -1
        rawValence = Math.sin(e.beta * Math.PI / 180);
      }
      const valence = Math.max(-1, Math.min(1, rawValence));
      const pos = valenceToPosition(valence, anchorsRef.current);

      const now = Date.now();
      if (now - lastSent < 50) return;
      lastSent = now;

      socketSendRef.current?.(JSON.stringify({
        type: 'touch',
        position: { x: pos.x, y: pos.y, timestamp: now, userId },
      }));

      const reactionState = computeReactionRegion(pos.x, pos.y, anchorsRef.current);
      setCanvasBackgroundReactionState(reactionState);
      setTouchPos({ x: (pos.x / 100) * window.innerWidth, y: (pos.y / 100) * window.innerHeight });
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
      socketSendRef.current?.(JSON.stringify({
        type: 'remove',
        position: { x: 0, y: 0, timestamp: Date.now(), userId },
      }));
      setCanvasBackgroundReactionState(null);
      setTouchPos(null);
    };
  }, [valenceInputMode, orientationPermission, userId]);

  const roomHasSpace = userCap === null || presenceCount < userCap;

  const handleJoinRequest = () => {
    socketSendRef.current?.(JSON.stringify({ type: 'requestJoin' }));
  };

  if (!isEmcee && !isPresenter && !isTouchDevice() && !isMobileForced()) {
    return <MobileOnlyGate />;
  }

  const room = getRoomParamFromUrl();
  const anchors = serverAnchors ?? DEFAULT_ANCHORS;
  // URL param overrides server; server overrides default; null = admin explicitly hid labels
  const urlLabelParam = getLabelsParamFromUrl();
  const labels = urlLabelParam ? getReactionLabelSet(urlLabelParam) : serverLabels;

  const showChipBar = unlockedInterfaces.length >= 2;
  const chipBarOffset = showChipBar ? CHIP_BAR_HEIGHT : 0;
  const KNOWN_CHIPS = Object.fromEntries(PANEL_REGISTRY.map(p => [p.id, p.id === 'canvas' ? SOLO_SCREEN_LABEL : (p.shortLabel ?? p.label)]));
  const panelContextValue = useMemo(() => ({ room, userId, inviteEdges }), [room, userId, inviteEdges]);
  const INTERFACE_CHIPS = unlockedInterfaces.map(key => ({
    key,
    label: KNOWN_CHIPS[key] ?? (key.charAt(0).toUpperCase() + key.slice(1)),
  }));

  return (
    <div className="v2-app-container">
      {showChipBar && (
        <InterfaceChipBar
          interfaces={INTERFACE_CHIPS}
          active={activeInterface}
          onSelect={setActiveInterface}
        />
      )}
      <PanelContextProvider value={panelContextValue}>
        <SocialMediaConfigProvider value={{ socialMediaConfig: serverSocialConfig }}>
        <GreeterConfigProvider value={{ greeterConfig: serverGreeterConfig }}>
        <MapViewerConfigProvider value={{ config: mapViewerConfig }}>
          {activeInterface === 'emcee' && (
            <AdminPanelNoDB room={room} userId={userId} selfChain={selfChain} mapViewerConfig={mapViewerConfig} onMapViewerConfigChange={setMapViewerConfig} />
          )}
          {(() => {
            const panelId = activeInterface !== 'canvas' && activeInterface !== 'emcee'
              ? activeInterface
              : activeInterface === 'canvas' ? activity : null;
            const ActivePanel = panelId ? PANEL_COMPONENTS[panelId] : null;
            // When a panel activity is active, show it as a flex sibling; the canvas
            // container stays mounted below to keep the WebSocket alive.
            return ActivePanel ? <ActivePanel /> : null;
          })()}
        </MapViewerConfigProvider>
        </GreeterConfigProvider>
        </SocialMediaConfigProvider>
      </PanelContextProvider>
      {/* Canvas is always mounted to keep the WebSocket alive for all interfaces */}
      <div className="v2-vote-canvas-container" style={{ flex: 1, display: (activeInterface === 'canvas' && !PANEL_COMPONENTS[activity]) ? undefined : 'none' }}>
          {activity === 'image-canvas' && serverImageUrl && (
            <img
              src={serverImageUrl}
              className="image-canvas-bg"
              alt=""
            />
          )}
          {labels && activity === 'canvas' && <div className="reaction-label reaction-label-positive" style={{ ...reactionLabelStyle(anchors.positive), ...(ownValenceDisplay === 'labels' && canvasBackgroundReactionState === 'positive' ? { background: 'rgba(0, 255, 0, 0.2)' } : {}) }}>{labels.positive}</div>}
          {labels && activity === 'canvas' && <div className="reaction-label reaction-label-negative" style={{ ...reactionLabelStyle(anchors.negative), ...(ownValenceDisplay === 'labels' && canvasBackgroundReactionState === 'negative' ? { background: 'rgba(255, 0, 0, 0.2)' } : {}) }}>{labels.negative}</div>}
          {labels && activity === 'canvas' && <div className="reaction-label reaction-label-neutral" style={{ ...reactionLabelStyle(anchors.neutral), ...(ownValenceDisplay === 'labels' && canvasBackgroundReactionState === 'neutral' ? { background: 'rgba(255, 255, 0, 0.2)' } : {}) }}>{labels.neutral}</div>}
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
          <ShareQRButton userId={userId} selfChain={selfChain} />
          {activity !== 'signature' && (
            <div onPointerDown={hapticOnPointerDown}>
              <HapticIndicatorButton
                enabled={hapticEffectivelyEnabled}
                flashing={hapticFlashing}
                canVibrate={WebHaptics.isSupported}
                onToggle={hapticOnToggle}
                onShowInfo={() => setHapticPending(true)}
              />
            </div>
          )}
          {isOrientationMode && (
            <WakeLockIndicatorButton
              enabled={wakeLockEnabled}
              active={wakeLockAcquired}
              onToggle={() => setWakeLockEnabled(prev => !prev)}
            />
          )}
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
            cursorSmoothingConfig={SMOOTH_CURSOR_ENABLED ? { ...SMOOTH_CURSOR_CONFIG, showSmoothCursor: true } : undefined}
            hideActualCursors={SMOOTH_CURSOR_ENABLED}
            disableCursorValence={activity === 'image-canvas'}
            disableBackgroundValence={activity === 'image-canvas'}
            onOwnValenceDisplayChange={setOwnValenceDisplay}
            onValenceInputModeChange={(mode) => {
              if (hasConnectedRef.current && !isEmcee) triggerBuzzForUpdate();
              setValenceInputMode(mode);
            }}
            currentReactionState={canvasBackgroundReactionState}
            heightOffset={chipBarOffset}
            onPresenceCount={setPresenceCount}
            onActiveCursorCountChange={setActiveCursorCount}
            onSimulatedCursorCountChange={setSimulatedCursorCount}
            onRecordingStateChange={setIsRecording}
            onConnected={(initialInviteEdges, currentActivity) => {
              hasConnectedRef.current = true;
              if (currentActivity) setActivity(currentActivity);
              if (initialInviteEdges) setInviteEdges(initialInviteEdges);
              const myChain = appendSelfToChain(selfChain, userId);
              const edges = chainToEdges(myChain);
              if (edges.length > 0) {
                socketSendRef.current?.(JSON.stringify({ type: 'recordInvitations', edges }));
              }
              const customPhoto = getCustomPhotoFromUrl();
              if (customPhoto) {
                socketSendRef.current?.(JSON.stringify({ type: 'registerCustomAvatar', userId, photoUrl: customPhoto }));
              }
            }}
            onRoomLabelsChange={handleRoomLabelsChange}
            onRoomAnchorsChange={setServerAnchors}
            onViewerCount={setViewerCount}
            onConnectedAsViewer={(viewer, cap) => { setIsViewer(viewer); setUserCap(cap); }}
            onUserCapChanged={setUserCap}
            onJoinApproved={() => setIsViewer(false)}
            onSocketReady={(send) => { socketSendRef.current = send; }}
            onActivityTriggered={(activityName) => {
              if (activityName === 'githubUsername') setShowGithubModal(true);
              if (activityName === 'feedbackStars') setShowFeedbackStarsModal(true);
            }}
            onInterfacePushed={(name) => setPushedInterface(name)}
            onHapticPushed={() => {
              if (hapticFlashTimeoutRef.current) clearTimeout(hapticFlashTimeoutRef.current);
              setHapticFlashing(true);
              hapticFlashTimeoutRef.current = setTimeout(() => setHapticFlashing(false), 500);
              if (hapticEnabled && WebHaptics.isSupported) {
                triggerHaptic('nudge');
              } else if (!WebHaptics.isSupported && !suppressHapticModal) {
                setHapticPending(true);
              }
            }}
            onPushedInterfacesCleared={() => {
              localStorage.removeItem(PUSHED_INTERFACES_KEY);
              setUnlockedInterfaces(getUnlockedInterfaces());
              setActiveInterface(prev => {
                const urlBased = getUnlockedInterfaces();
                return urlBased.includes(prev) ? prev : (urlBased.includes('emcee') ? 'emcee' : 'canvas');
              });
            }}
            onRoomImageUrlChange={handleRoomImageUrlChange}
            onActivityChange={handleActivityChange}
            onSocialConfigChange={setServerSocialConfig}
            onGreeterConfigChange={setServerGreeterConfig}
            onNowLabelChange={setNowLabel}
            onInviteEdges={(edges) => setInviteEdges(prev => ({ ...prev, ...edges }))}
            onStrokeSegment={(uid, strokeId, points) => {
              setSignatureStrokes(prev => {
                const user = [...(prev[uid] ?? [])];
                const idx = user.findIndex(s => s.strokeId === strokeId);
                if (idx === -1) return { ...prev, [uid]: [...user, { strokeId, points }] };
                const updated = [...user];
                updated[idx] = { strokeId, points: [...updated[idx].points, ...points] };
                return { ...prev, [uid]: updated };
              });
            }}
            onSignatureCleared={(uid) => setSignatureStrokes(prev => { const n = { ...prev }; delete n[uid]; return n; })}
            onConnectedUsers={(ids) => setConnectedUserIds(ids)}
            onUserJoined={(uid) => setConnectedUserIds(prev => prev.includes(uid) ? prev : [...prev, uid])}
            onUserLeft={(uid) => setConnectedUserIds(prev => prev.filter(id => id !== uid))}
            debug={debug}
          />
          {nowLabel && (
            <div
              className="canvas-now-label"
              style={{ top: `calc(${anchors.positive.y}% + 60px)` }}
            >
              {nowLabel}
            </div>
          )}
          {valenceInputMode !== 'touch' && orientationPermission === 'unknown' && (
            <div className="viewer-mode-banner">
              Tap to enable device orientation tracking
              <button className="viewer-join-btn" onClick={requestOrientationPermission}>Enable</button>
            </div>
          )}
          {valenceInputMode !== 'touch' && orientationPermission === 'denied' && (
            <div className="viewer-mode-banner">
              {!window.isSecureContext
                ? 'Orientation needs HTTPS — works on the deployed app, not over local network HTTP.'
                : 'Orientation permission denied — switch back to Touch mode to react.'}
            </div>
          )}
          {!isViewer && activity !== 'social-sharing' && activity !== 'greeter' && activity !== 'signature' && (
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
              imageUrl={activity === 'image-canvas' ? (serverImageUrl || undefined) : undefined}
              disabled={valenceInputMode !== 'touch'}
            />
          )}
          {activity === 'signature' && !isPresenter && !isViewer && (
            <SignatureLayer
              userId={userId}
              onSendMessage={(msg) => socketSendRef.current?.(msg)}
              heightOffset={chipBarOffset}
            />
          )}
          {activity === 'signature' && isPresenter && (
            <SignatureCanvas
              userId={userId}
              strokes={signatureStrokes}
              heightOffset={chipBarOffset}
            />
          )}
          {activity === 'signature' && !isViewer && (
            <button
              onClick={() => setIsPresenter(p => !p)}
              style={{
                position: 'absolute',
                top: 7,
                right: 'calc(6% + 46px)',
                zIndex: 30,
                height: 30,
                padding: '0 14px',
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.7)',
                background: 'rgba(60,60,60,0.72)',
                color: 'rgba(255,255,255,0.95)',
                fontSize: 13,
                cursor: 'pointer',
                letterSpacing: '0.04em',
                whiteSpace: 'nowrap',
              }}
            >
              {isPresenter ? 'Sign' : 'Show: Grid'}
            </button>
          )}
        </div>
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
      {showFeedbackStarsModal && (
        <FeedbackStarsModal
          onSubmit={(stars) => {
            socketSendRef.current?.(JSON.stringify({
              type: 'submitFeedbackStars',
              userId,
              stars,
              timestamp: Date.now(),
            }));
            setShowFeedbackStarsModal(false);
          }}
          onDismiss={() => setShowFeedbackStarsModal(false)}
        />
      )}
      {pushedInterface && (
        <InterfacePushModal
          interfaceName={pushedInterface}
          onAccept={() => {
            socketSendRef.current?.(JSON.stringify({ type: 'acceptInterface', interfaceName: pushedInterface }));
            setUnlockedInterfaces(prev => {
              if (prev.includes(pushedInterface)) return prev;
              try {
                const stored: string[] = JSON.parse(localStorage.getItem(PUSHED_INTERFACES_KEY) ?? '[]');
                if (!stored.includes(pushedInterface)) {
                  localStorage.setItem(PUSHED_INTERFACES_KEY, JSON.stringify([...stored, pushedInterface]));
                }
              } catch { /* ignore */ }
              return [...prev, pushedInterface];
            });
            setActiveInterface(pushedInterface);
            setPushedInterface(null);
          }}
          onDecline={() => setPushedInterface(null)}
        />
      )}
      {hapticPending && (
        <HapticPushModal
          onDismiss={() => setHapticPending(false)}
          suppressed={suppressHapticModal}
          onSuppressChange={v => { setSuppressHapticModal(v); localStorage.setItem('v4-suppress-haptic-modal', String(v)); }}
        />
      )}
    </div>
  );
}
