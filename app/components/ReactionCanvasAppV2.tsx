import { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import Canvas from "./Canvas";
import TouchLayer from "./TouchLayer";
import { getReactionLabelSet } from "../voteLabels";

type VoteState = 'agree' | 'disagree' | 'pass' | null;

const YOUTUBE_HEIGHT_FRACTION = 0.45; // YouTube player takes 45vh

function getRoomFromUrl(): string {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('room') ?? 'default';
}

function getVideoIdFromUrl(): string {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('videoId') ?? '';
}

function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

function isMobileOverridden(): boolean {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('mobile') === 'true';
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
  const [canvasBackgroundVoteState, setCanvasBackgroundVoteState] = useState<VoteState>(null);
  const voteStateRef = useRef<VoteState>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [touchPos, setTouchPos] = useState<{ x: number; y: number } | null>(null);

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

  const handleTouchPosition = (pos: { x: number; y: number } | null) => {
    setTouchPos(pos);
    const cmd = pos ? 'playVideo' : 'pauseVideo';
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func: cmd, args: '' }), '*'
    );
  };

  if (!isTouchDevice() && !isMobileOverridden()) {
    return <MobileOnlyGate />;
  }

  const room = getRoomFromUrl();
  const videoId = videoIdProp ?? getVideoIdFromUrl();
  const labels = getReactionLabelSet();

  return (
    <div className="v2-app-container">
      <div className="v2-youtube-container" style={{ height: youtubeHeight }}>
        {videoId ? (
          <iframe
            ref={iframeRef}
            src={`https://www.youtube-nocookie.com/embed/${videoId}?controls=0&modestbranding=1&rel=0&iv_load_policy=3&cc_load_policy=0&enablejsapi=1`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="v2-no-video">No video — add <code>?videoId=</code> to the URL (<a href="?videoId=s-ONlhskCrA#v2">example</a>)</div>
        )}
      </div>
      <div className="v2-vote-canvas-container">
        <div className="vote-label vote-label-agree">{labels.agree}</div>
        <div className="vote-label vote-label-disagree">{labels.disagree}</div>
        <div className="vote-label vote-label-pass">{labels.pass}</div>
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
          heightOffset={youtubeHeight}
        />
        <TouchLayer
          room={room}
          userId={userId}
          onActiveStatementChange={() => {}}
          onVoteStateChange={() => {}}
          voteStateRef={voteStateRef}
          onBackgroundColorChange={setCanvasBackgroundVoteState}
          onTouchPosition={handleTouchPosition}
          heightOffset={youtubeHeight}
        />
      </div>
    </div>
  );
}
