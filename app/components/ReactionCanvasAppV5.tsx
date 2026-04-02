import { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import Canvas from "./Canvas";
import TouchLayer from "./TouchLayer";
import AdminPanelV5 from "./AdminPanelV5";
import ReplayCanvas from "./ReplayCanvas";
import { getReactionLabelSet } from "../voteLabels";
import type { ReactionLabelSet } from "../voteLabels";
import { DEFAULT_ANCHORS, reactionLabelStyle } from "../utils/voteRegion";
import type { ReactionAnchors } from "../utils/voteRegion";
import { insertEvent, fetchEvents, isSupabaseConfigured, testConnection } from "../lib/supabase";
import type { ReactionEvent } from "../lib/supabase";
import { getPersistentUserId } from "../utils/userId";

declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string,
        config: {
          videoId?: string;
          events?: {
            onReady?: (event: { target: YTPlayer }) => void;
            onStateChange?: (event: { data: number }) => void;
          };
          playerVars?: Record<string, string | number>;
        }
      ) => YTPlayer;
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

interface YTPlayer {
  getCurrentTime(): number;
  getPlayerState(): number;
  playVideo(): void;
  pauseVideo(): void;
}

const YT_PLAYING = 1;
const YOUTUBE_HEIGHT_FRACTION = 0.45;
const THROTTLE_MS = 150;

type ReactionState = 'positive' | 'negative' | 'neutral' | null;

function getRoomFromUrl(): string {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('room') ?? urlParams.get('videoId') ?? '';
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

export default function ReactionCanvasAppV5() {
  const [sessionId] = useState(() => getPersistentUserId());
  const [userId] = useState(() => getPersistentUserId());
  const [canvasBackgroundReactionState, setCanvasBackgroundReactionState] = useState<ReactionState>(null);
  const [serverLabels, setServerLabels] = useState<ReactionLabelSet | null | undefined>(undefined);
  const [serverAnchors, setServerAnchors] = useState<ReactionAnchors | null>(null);
  const [touchPos, setTouchPos] = useState<{ x: number; y: number } | null>(null);
  const [debug, setDebug] = useState(() => new URLSearchParams(window.location.search).get('debug') === '1');
  const [recordedEvents, setRecordedEvents] = useState<ReactionEvent[]>([]);
  const [currentTimecode, setCurrentTimecode] = useState(0);
  const currentTimecodeRef = useRef(0);
  const playerRef = useRef<YTPlayer | null>(null);
  const lastInsertRef = useRef(0);
  const reactionStateRef = useRef<ReactionState>(null);

  const videoId = getRoomFromUrl();
  const room = videoId || 'default';

  const [youtubeHeight, setYoutubeHeight] = useState(
    Math.round(window.innerHeight * YOUTUBE_HEIGHT_FRACTION)
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'd') setDebug(prev => !prev);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setYoutubeHeight(Math.round(window.innerHeight * YOUTUBE_HEIGHT_FRACTION));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load YouTube IFrame API
  useEffect(() => {
    if (!videoId) return;

    window.onYouTubeIframeAPIReady = () => {
      playerRef.current = new window.YT.Player('v5-youtube-player', {
        videoId,
        playerVars: { controls: debug ? 1 : 0, modestbranding: 1, rel: 0, iv_load_policy: 3, cc_load_policy: 0 },
        events: {
          onReady: (event) => { event.target.pauseVideo(); },
        },
      });
    };

    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);

    return () => {
      // Cleanup: remove the script tag and the global callback
      if (script.parentNode) script.parentNode.removeChild(script);
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      window.onYouTubeIframeAPIReady = () => {};
    };
  }, [videoId]);

  // Poll timecode every 100ms when player is available
  useEffect(() => {
    const interval = setInterval(() => {
      if (!playerRef.current) return;
      try {
        if (playerRef.current.getPlayerState() === YT_PLAYING) {
          const t = playerRef.current.getCurrentTime();
          currentTimecodeRef.current = t;
          setCurrentTimecode(t);
        }
      } catch {
        // player not ready yet
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Single-user touch-to-play: play when touching, pause when not
  useEffect(() => {
    if (!playerRef.current) return;
    try {
      if (touchPos !== null) {
        playerRef.current.playVideo();
      } else {
        playerRef.current.pauseVideo();
      }
    } catch {
      // player not ready yet
    }
  }, [touchPos]);

  // Test Supabase connection on mount
  useEffect(() => { testConnection(); }, []);

  // Fetch recorded events on mount
  useEffect(() => {
    fetchEvents(room).then(setRecordedEvents);
  }, [room]);

  const handleCursorEvent = (type: 'move' | 'touch' | 'remove', pos: { x: number; y: number }) => {
    const now = Date.now();
    if (now - lastInsertRef.current < THROTTLE_MS) return;
    lastInsertRef.current = now;

    const eventType = type === 'remove' ? 'lift' : type;
    insertEvent({
      room,
      session_id: sessionId,
      type: eventType,
      x: type === 'remove' ? null : pos.x,
      y: type === 'remove' ? null : pos.y,
      timecode: currentTimecodeRef.current,
    });
  };

  if (isAdminMode()) {
    return <AdminPanelV5 room={room} />;
  }

  if (!isTouchDevice() && !isMobileForced()) {
    return <MobileOnlyGate />;
  }

  const anchors = serverAnchors ?? DEFAULT_ANCHORS;
  // URL param overrides server; server overrides default; null = admin explicitly hid labels
  const urlLabelParam = getLabelsParamFromUrl();
  const labels = urlLabelParam ? getReactionLabelSet(urlLabelParam) : (serverLabels !== undefined ? serverLabels : getReactionLabelSet());

  return (
    <div className="v5-app-container">
      <div className="v5-youtube-container" style={{ height: youtubeHeight }}>
        {videoId ? (
          <>
            <div
              id="v5-youtube-player"
              style={{ width: '100%', height: '100%' }}
            />
            {!debug && <div className="v2-youtube-overlay" />}
          </>
        ) : (
          <div className="v2-no-video">No video — add <code>?room=&lt;youtube-id&gt;</code> to the URL (<a href={(() => { const p = new URLSearchParams(window.location.search); p.set('room', 'irc6creOFGs'); return `?${p}${window.location.hash}`; })()}>example</a>)</div>
        )}
      </div>
      <div className="v5-vote-canvas-container">
        {labels && <div className="reaction-label reaction-label-positive" style={reactionLabelStyle(anchors.positive)}>{labels.positive}</div>}
        {labels && <div className="reaction-label reaction-label-negative" style={reactionLabelStyle(anchors.negative)}>{labels.negative}</div>}
        {labels && <div className="reaction-label reaction-label-neutral" style={reactionLabelStyle(anchors.neutral)}>{labels.neutral}</div>}
        <div className={`v3-rec-badge v3-rec-badge--left${isSupabaseConfigured ? '' : ' v3-rec-badge--off'}`}>● REC</div>
        <div className="debug-hint">{debug ? 'd: debug on' : 'd: debug'}</div>
        {touchPos && (
          <div
            className="v5-touch-indicator"
            style={{ left: touchPos.x, top: touchPos.y }}
          />
        )}
        <ReplayCanvas
          events={recordedEvents}
          currentTimecode={currentTimecode}
          heightOffset={youtubeHeight}
        />
        <Canvas
          room={room}
          userId={userId}
          colorCursorsByVote={false}
          hideCursors={true}
          currentReactionState={canvasBackgroundReactionState}
          heightOffset={youtubeHeight}
          onRoomLabelsChange={setServerLabels}
          onRoomAnchorsChange={setServerAnchors}
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
          heightOffset={youtubeHeight}
          anchors={anchors}
          onCursorEvent={handleCursorEvent}
        />
      </div>
    </div>
  );
}
