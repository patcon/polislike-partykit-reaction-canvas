import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import ReactionCanvasParticipant from "../shared/ReactionCanvasParticipant";
import AdminPanelNoDB from "../panels/AdminPanelNoDB";
import InterfaceChipBar from "../shared/InterfaceChipBar";
import type { SocialConfig, ValenceInputMode } from "../../types";
import { PANEL_REGISTRY } from "../../panelRegistry";
import type { PanelDefinition } from "../../panelRegistry";
import { PanelContextProvider } from "../../context/PanelContext";
import { RoomSocketProvider, useMessageSubscription } from "../../contexts/RoomSocketContext";
import { GreeterConfigProvider } from "../../../plugins/greeter/useGreeterConfig";
import type { GreeterConfig } from "../../../plugins/greeter/types";
// TODO: plugins should declare their own providers so the app can wrap them
// generically (e.g. via a PanelPlugin.provider field) rather than importing
// each by name here.
import { SocialMediaConfigProvider } from "../../../plugins/socialSharing/context";
import { ImageCanvasConfigProvider } from "../../../plugins/imageCanvas/context";
import GithubUsernameModal from "../modals/GithubUsernameModal";
import FeedbackStarsModal from "../modals/FeedbackStarsModal";
import InterfacePushModal from "../modals/InterfacePushModal";
import HapticPushModal from "../modals/HapticPushModal";
import { WebHaptics } from "web-haptics";
import { useWebHaptics } from "web-haptics/react";
import { DEFAULT_ANCHORS, valenceToPosition, computeReactionRegion } from "../../utils/voteRegion";
import type { ReactionAnchors } from "../../utils/voteRegion";
import { getReactionLabelSet, REACTION_LABEL_PRESETS } from "../../voteLabels";
import type { ReactionLabelSet } from "../../voteLabels";
import { getPersistentUserId } from "../../utils/userId";
import QRWithCopy from "../shared/QRWithCopy";
import { parseInviteChain, appendSelfToChain, chainToEdges, storeChain, getStoredChain } from "../../utils/inviteChain";
import HapticIndicatorButton from "../shared/HapticIndicatorButton";
import { useHapticPriming } from "../../hooks/useHapticPriming";
import WakeLockIndicatorButton from "../shared/WakeLockIndicatorButton";
import { useWakeLock } from "../../utils/useWakeLock";
import { PLUGIN_MAP } from "../../../plugins/index";

const PANEL_COMPONENTS: Partial<Record<string, PanelDefinition['component']>> = {
  ...Object.fromEntries(
    Object.entries(PLUGIN_MAP)
      .filter(([, p]) => p.component)
      .map(([id, p]) => [id, p.component!])
  ),
};

type ReactionState = 'positive' | 'negative' | 'neutral' | null;


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

const HIDE_CHIP_BAR = new URLSearchParams(window.location.search).get('hideChipBar') === 'true';

function getUnlockedInterfaces(): string[] {
  const p = new URLSearchParams(window.location.search);
  const interfaces = ['personal'];
  // emcee and commons are URL-privileged; all other standalone interfaces unlock via ?addInterface= (localStorage-backed)
  if (p.get('interface') === 'emcee') interfaces.push('emcee');
  if (p.get('interface') === 'commons') interfaces.push('commons');
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

export default function ReactionCanvasAppV4({ room }: { room: string }) {
  const [userId] = useState(() => getPersistentUserId());
  return (
    <RoomSocketProvider room={room} userId={userId}>
      <ReactionCanvasAppV4Inner room={room} userId={userId} />
    </RoomSocketProvider>
  );
}

function ReactionCanvasAppV4Inner({ room, userId }: { room: string; userId: string }) {
  const [unlockedInterfaces, setUnlockedInterfaces] = useState(() => getUnlockedInterfaces());
  const [activeInterface, setActiveInterface] = useState(() => {
    const unlocked = getUnlockedInterfaces();
    const p = new URLSearchParams(window.location.search);
    const fromUrl = p.get('interface');
    if (fromUrl && unlocked.includes(fromUrl)) return fromUrl;
    const saved = localStorage.getItem('v4-active-interface');
    if (saved && unlocked.includes(saved)) return saved;
    return unlocked.includes('emcee') ? 'emcee' : 'personal';
  });
  const [selfChain] = useState<string[]>(() => {
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
  const [isViewer, setIsViewer] = useState(false);
  const [userCap, setUserCap] = useState<number | null>(null);
  const socketSendRef = useRef<((msg: string) => void) | null>(null);
  const [touchPos, setTouchPos] = useState<{ x: number; y: number } | null>(null);
  const [serverLabels, setServerLabels] = useState<ReactionLabelSet | null>(null);
  const [serverAnchors, setServerAnchors] = useState<ReactionAnchors | null>(null);
  const [serverImageUrl, setServerImageUrl] = useState('');
  const [serverSocialConfig, setServerSocialConfig] = useState<SocialConfig | null>(null);
  const [serverGreeterConfig, setServerGreeterConfig] = useState<GreeterConfig | null>(null);
  const [screenPanels, setScreenPanels] = useState<Record<string, string>>({ personal: 'canvas', commons: 'canvas' });
  const [valenceInputMode, setValenceInputMode] = useState<ValenceInputMode>('touch');
  const [orientationPermission, setOrientationPermission] = useState<'unknown' | 'granted' | 'denied' | 'not-required'>('unknown');
  const [connectedUserIds, setConnectedUserIds] = useState<string[]>([]);
  const [debug, setDebug] = useState(() => new URLSearchParams(window.location.search).get('debug') === '1');
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
  const personalScreenPanel = screenPanels['personal'] ?? 'canvas';
  const commonsScreenPanel  = screenPanels['commons']  ?? 'canvas';
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

  const handleConnectedAsViewer = useCallback((viewer: boolean, cap: number | null) => {
    setIsViewer(viewer);
    setUserCap(cap);
  }, []);

  const socialMediaConfigValue = useMemo(() => ({ socialMediaConfig: serverSocialConfig }), [serverSocialConfig]);
  const greeterConfigValue = useMemo(() => ({ greeterConfig: serverGreeterConfig }), [serverGreeterConfig]);
  const imageCanvasConfigValue = useMemo(() => ({ imageUrl: serverImageUrl }), [serverImageUrl]);

  useMessageSubscription((evt: MessageEvent) => {
    try {
      const data = JSON.parse(evt.data);
      if (data.type === 'screenPanelChanged') {
        const screenName = (data.screenName as string) ?? 'personal';
        if (hasConnectedRef.current && !isEmcee && unlockedInterfaces.includes(screenName)) triggerBuzzForUpdate();
        setScreenPanels(prev => ({ ...prev, [screenName]: (data.screenPanel as string) ?? 'canvas' }));
      }
      if (data.type === 'connected') {
        if ('currentScreenPanels' in data && data.currentScreenPanels && typeof data.currentScreenPanels === 'object') {
          setScreenPanels(prev => ({ ...prev, ...(data.currentScreenPanels as Record<string, string>) }));
        } else if ('currentScreenPanel' in data) {
          setScreenPanels(prev => ({ ...prev, personal: (data.currentScreenPanel as string) ?? 'canvas' }));
        }
      }
      if (data.type === 'interfacePushed') {
        setPushedInterface(data.interfaceName);
      }
      if (data.type === 'pushedInterfacesCleared') {
        localStorage.removeItem(PUSHED_INTERFACES_KEY);
        setUnlockedInterfaces(getUnlockedInterfaces());
        setActiveInterface(prev => {
          const urlBased = getUnlockedInterfaces();
          return urlBased.includes(prev) ? prev : (urlBased.includes('emcee') ? 'emcee' : 'personal');
        });
      }
      if (data.type === 'hapticPushed') {
        if (hapticFlashTimeoutRef.current) clearTimeout(hapticFlashTimeoutRef.current);
        setHapticFlashing(true);
        hapticFlashTimeoutRef.current = setTimeout(() => setHapticFlashing(false), 500);
        if (hapticEnabled && WebHaptics.isSupported) {
          triggerHaptic('nudge');
        } else if (!WebHaptics.isSupported && !suppressHapticModal) {
          setHapticPending(true);
        }
      }
    } catch { /* ignore */ }
  });

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

  if (!isEmcee && !isTouchDevice() && !isMobileForced()) {
    return <MobileOnlyGate />;
  }

  // URL param overrides server; server overrides default; null = admin explicitly hid labels
  const urlLabelParam = getLabelsParamFromUrl();
  const labels = urlLabelParam ? getReactionLabelSet(urlLabelParam) : (serverLabels ?? REACTION_LABEL_PRESETS.default);

  const showChipBar = !HIDE_CHIP_BAR && unlockedInterfaces.length >= 2;
  const chipBarOffset = showChipBar ? CHIP_BAR_HEIGHT : 0;
  const KNOWN_CHIPS: Record<string, string> = { personal: 'Push Screen', commons: 'Commons Screen', ...Object.fromEntries(PANEL_REGISTRY.map(p => [p.id, p.shortLabel ?? p.label])) };
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
        <SocialMediaConfigProvider value={socialMediaConfigValue}>
        <GreeterConfigProvider value={greeterConfigValue}>
        {activeInterface === 'emcee' && (
          <AdminPanelNoDB room={room} userId={userId} selfChain={selfChain} />
        )}
        {(() => {
          const panelId = ['personal', 'emcee', 'commons'].includes(activeInterface)
            ? (activeInterface === 'personal' ? personalScreenPanel
               : activeInterface === 'commons' ? commonsScreenPanel : null)
            : activeInterface;
          const ActivePanel = panelId ? PANEL_COMPONENTS[panelId] : null;
          return ActivePanel ? <ActivePanel /> : null;
        })()}
        </GreeterConfigProvider>
        </SocialMediaConfigProvider>
      </PanelContextProvider>
      {(activeInterface === 'personal' || activeInterface === 'commons') && (() => {
        const activeScreenPanel = activeInterface === 'commons' ? commonsScreenPanel : personalScreenPanel;
        return !PANEL_COMPONENTS[activeScreenPanel] ? (
        <ImageCanvasConfigProvider value={imageCanvasConfigValue}>
        <div className="v2-vote-canvas-container" style={{ flex: 1 }}>
            <ReactionCanvasParticipant
              room={room}
              userId={userId}
              screenName={activeInterface}
              selfChain={selfChain}
              debug={debug}
              heightOffset={chipBarOffset}
              labelsOverride={labels}
              showLabels={activeScreenPanel === 'canvas'}
              disableCursorValence={!!PLUGIN_MAP[activeScreenPanel]?.canvasOverlay?.canvasProps?.disableCursorValence}
              disableBackgroundValence={!!PLUGIN_MAP[activeScreenPanel]?.canvasOverlay?.canvasProps?.disableBackgroundValence}
              currentReactionState={canvasBackgroundReactionState}
              onBackgroundColorChange={setCanvasBackgroundReactionState}
              touchPos={touchPos}
              onTouchPosition={setTouchPos}
              touchDisabled={valenceInputMode !== 'touch'}
              hideTouchLayer={isViewer || activeScreenPanel === 'social-sharing' || activeScreenPanel === 'greeter' || activeScreenPanel === 'signature'}
              touchImageUrl={PLUGIN_MAP[activeScreenPanel]?.canvasOverlay?.background ? (serverImageUrl || undefined) : undefined}
              backgroundOverlay={(() => { const Bg = PLUGIN_MAP[activeScreenPanel]?.canvasOverlay?.background; return Bg ? <Bg /> : null; })()}
            bannerSlot={isViewer ? (
              <div className="viewer-mode-banner">
                This room is full — you are watching in view-only mode.
                {roomHasSpace && (
                  <button className="viewer-join-btn" onClick={handleJoinRequest}>Join</button>
                )}
              </div>
            ) : null}
            topRightSlot={
              <>
                <div onPointerDown={hapticOnPointerDown}>
                  <HapticIndicatorButton
                    enabled={hapticEffectivelyEnabled}
                    flashing={hapticFlashing}
                    canVibrate={WebHaptics.isSupported}
                    onToggle={hapticOnToggle}
                    onShowInfo={() => setHapticPending(true)}
                  />
                </div>
                {isOrientationMode && (
                  <WakeLockIndicatorButton
                    enabled={wakeLockEnabled}
                    active={wakeLockAcquired}
                    onToggle={() => setWakeLockEnabled(prev => !prev)}
                  />
                )}
              </>
            }
            canvasOverlay={
              <>
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
              </>
            }
            onConnected={(initialInviteEdges) => {
              hasConnectedRef.current = true;
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
            onValenceInputModeChange={(mode) => {
              if (hasConnectedRef.current && !isEmcee) triggerBuzzForUpdate();
              setValenceInputMode(mode);
            }}
            onRoomLabelsChange={handleRoomLabelsChange}
            onRoomAnchorsChange={setServerAnchors}
            onPresenceCount={setPresenceCount}
            onConnectedAsViewer={handleConnectedAsViewer}
            onUserCapChanged={setUserCap}
            onJoinApproved={() => setIsViewer(false)}
            onSocketReady={(send) => { socketSendRef.current = send; }}
            onActivityTriggered={(activityName) => {
              if (activityName === 'githubUsername') setShowGithubModal(true);
              if (activityName === 'feedbackStars') setShowFeedbackStarsModal(true);
            }}
            onRoomImageUrlChange={handleRoomImageUrlChange}
            onSocialConfigChange={setServerSocialConfig}
            onGreeterConfigChange={setServerGreeterConfig}
            onInviteEdges={(edges) => setInviteEdges(prev => ({ ...prev, ...edges }))}
            onConnectedUsers={(ids) => setConnectedUserIds(ids)}
            onUserJoined={(uid) => setConnectedUserIds(prev => prev.includes(uid) ? prev : [...prev, uid])}
            onUserLeft={(uid) => setConnectedUserIds(prev => prev.filter(id => id !== uid))}
            />
          </div>
        </ImageCanvasConfigProvider>
        ) : null;
      })()}
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
