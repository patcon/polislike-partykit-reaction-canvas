import { useState, useEffect, useRef } from "react";
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

export default function ReactionCanvasAppV2({ videoId: videoIdProp }: { videoId?: string }) {
  const room = getRoomFromUrl();
  const videoId = videoIdProp ?? getVideoIdFromUrl();

  const [userId] = useState(() => Math.random().toString(36).substr(2, 9));
  const [canvasBackgroundVoteState, setCanvasBackgroundVoteState] = useState<VoteState>(null);
  const voteStateRef = useRef<VoteState>(null);

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

  const labels = getReactionLabelSet();

  return (
    <div className="v2-app-container">
      <div className="v2-youtube-container" style={{ height: youtubeHeight }}>
        {videoId ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoId}?controls=0&modestbranding=1&rel=0&iv_load_policy=3&cc_load_policy=0`}
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
          heightOffset={youtubeHeight}
        />
      </div>
    </div>
  );
}
