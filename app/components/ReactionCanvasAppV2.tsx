import { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import Canvas from "./Canvas";
import TouchLayer from "./TouchLayer";
import { getReactionLabelSet } from "../voteLabels";
import { DEFAULT_ANCHORS, reactionLabelStyle } from "../utils/voteRegion";

type ReactionState = 'positive' | 'negative' | 'neutral' | null;

const YOUTUBE_HEIGHT_FRACTION = 0.45; // YouTube player takes 45vh

function getRoomFromUrl(): string {
  const urlParams = new URLSearchParams(window.location.search);
  // ?room= is preferred; ?videoId= is a deprecated alias kept for backward compatibility
  return urlParams.get('room') ?? urlParams.get('videoId') ?? '';
}

function getLabelsParamFromUrl(): string | undefined {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('labels') ?? undefined;
}

function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

function isMobileForced(): boolean {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('forceView') === 'mobile';
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

export default function ReactionCanvasAppV2({ videoId: videoIdProp }: { videoId?: string }) {
  const [userId] = useState(() => Math.random().toString(36).substr(2, 9));
  const [canvasBackgroundReactionState, setCanvasBackgroundReactionState] = useState<ReactionState>(null);
  const [presenceCount, setPresenceCount] = useState<number>(0);
  const [activeCursorCount, setActiveCursorCount] = useState<number>(0);
  const [isViewer, setIsViewer] = useState(false);
  const [userCap, setUserCap] = useState<number | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const socketSendRef = useRef<((msg: string) => void) | null>(null);
  const reactionStateRef = useRef<ReactionState>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [touchPos, setTouchPos] = useState<{ x: number; y: number } | null>(null);
  const [debug, setDebug] = useState(false);
  const allTouchingRef = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'd') setDebug(prev => !prev);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Track video timecode locally: seek offset + elapsed play time
  const seekOffsetRef = useRef(0);
  const playStartRef = useRef<number | null>(null);

  const getCurrentTimecode = () => {
    if (playStartRef.current === null) return seekOffsetRef.current;
    return seekOffsetRef.current + (Date.now() - playStartRef.current) / 1000;
  };

  const seekTo = (timecode: number) => {
    seekOffsetRef.current = timecode;
    playStartRef.current = null;
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func: 'seekTo', args: [timecode, true] }), '*'
    );
    // seekTo can resume playback on YouTube even when the player was paused.
    // Explicitly re-pause if we shouldn't be playing.
    if (!allTouchingRef.current) {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: 'pauseVideo', args: '' }), '*'
      );
    }
  };

  const allTouching = presenceCount > 0 && touchPos !== null && activeCursorCount >= presenceCount - 1;
  allTouchingRef.current = allTouching;

  const videoId = videoIdProp ?? getRoomFromUrl();
  const room = videoId || 'default';

  const [youtubeHeight, setYoutubeHeight] = useState(
    Math.round(window.innerHeight * YOUTUBE_HEIGHT_FRACTION)
  );

  useEffect(() => {
    const handleResize = () => {
      setYoutubeHeight(Math.round(window.innerHeight * YOUTUBE_HEIGHT_FRACTION));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (allTouching) {
      playStartRef.current = Date.now();
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: 'playVideo', args: '' }), '*'
      );
    } else {
      playStartRef.current = null;
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: 'pauseVideo', args: '' }), '*'
      );
    }
  }, [allTouching]);

  const handleTouchPosition = (pos: { x: number; y: number } | null) => {
    setTouchPos(pos);
  };

  const roomHasSpace = userCap === null || presenceCount < userCap;

  const handleJoinRequest = () => {
    socketSendRef.current?.(JSON.stringify({ type: 'requestJoin' }));
  };

  if (!isTouchDevice() && !isMobileForced()) {
    return <MobileOnlyGate />;
  }

  const labels = getReactionLabelSet(getLabelsParamFromUrl());

  return (
    <div className="v2-app-container">
      <div className="v2-youtube-container" style={{ height: youtubeHeight }}>
        {videoId ? (
          <>
            <iframe
              ref={iframeRef}
              src={`https://www.youtube-nocookie.com/embed/${videoId}?controls=0&modestbranding=1&rel=0&iv_load_policy=3&cc_load_policy=0&enablejsapi=1`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              onLoad={() => {
                // On desktop, YouTube can resume a previously-playing session after refresh
                // because the pauseVideo from the allTouching effect fires before the iframe
                // is ready to receive commands. Re-send it here once the iframe is loaded.
                // On real touch devices this is unnecessary: mobile browsers block autoplay
                // without a user gesture, so sending pauseVideo to an unstarted player only
                // causes it to go black (paused-with-no-frame + controls=0 = invisible).
                if (!allTouchingRef.current && !isTouchDevice()) {
                  iframeRef.current?.contentWindow?.postMessage(
                    JSON.stringify({ event: 'command', func: 'pauseVideo', args: '' }), '*'
                  );
                }
              }}
            />
            <div className="v2-youtube-overlay" />
            {!allTouching && (
              <div className="v2-video-paused-overlay">
                <div className="v2-paused-overlay-content">
                  <QRCodeSVG value={window.location.href} size={72} bgColor="#ffffff" fgColor="#000000" />
                  <p>Everyone watching must keep a finger on the space below to keep the video playing</p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="v2-no-video">No video — add <code>?room=&lt;youtube-id&gt;</code> to the URL (<a href="?room=izDAOvHz5Wc#v2">example</a>)</div>
        )}
      </div>
      <div className="v2-vote-canvas-container">
        {labels && <div className="reaction-label reaction-label-positive" style={reactionLabelStyle(DEFAULT_ANCHORS.positive)}>{labels.positive}</div>}
        {labels && <div className="reaction-label reaction-label-negative" style={reactionLabelStyle(DEFAULT_ANCHORS.negative)}>{labels.negative}</div>}
        {labels && <div className="reaction-label reaction-label-neutral" style={reactionLabelStyle(DEFAULT_ANCHORS.neutral)}>{labels.neutral}</div>}
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
          {userCap !== null && <span className="v2-counter-dim">/{userCap}</span>} here · <span className="v2-counter-num">{activeCursorCount + (touchPos !== null ? 1 : 0)}</span> touching {allTouching ? '▶️' : '⏸️'}
          {viewerCount > 0 && <> · <span className="v2-counter-num">{viewerCount}</span> watching</>}
        </div>
        <div className="debug-hint">{debug ? 'd: debug on' : 'd: debug'}</div>
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
          heightOffset={youtubeHeight}
          onPresenceCount={setPresenceCount}
          onActiveCursorCountChange={setActiveCursorCount}
          onTimecodeUpdate={seekTo}
          onViewerCount={setViewerCount}
          onConnectedAsViewer={(viewer, cap) => { setIsViewer(viewer); setUserCap(cap); }}
          onUserCapChanged={setUserCap}
          onJoinApproved={() => setIsViewer(false)}
          onSocketReady={(send) => { socketSendRef.current = send; }}
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
            onTouchPosition={handleTouchPosition}
            heightOffset={youtubeHeight}
            getTimecode={getCurrentTimecode}
          />
        )}
      </div>
    </div>
  );
}
