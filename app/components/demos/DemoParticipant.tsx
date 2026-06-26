import { useState, useRef } from "react";
import Canvas from "../shared/Canvas";
import TouchLayer from "../shared/TouchLayer";
import { DEFAULT_ANCHORS, reactionLabelStyle, type ReactionRegion } from "../../utils/voteRegion";
import { REACTION_LABEL_PRESETS } from "../../voteLabels";

const LABELS = REACTION_LABEL_PRESETS.default;

/**
 * A working participant reaction canvas for the demos: region labels +
 * Canvas (cursor display) + TouchLayer (pointer input). Both Canvas and
 * TouchLayer use `autoSize` so coordinates are correct inside the phone frame.
 * Mounts inside PhoneFrame's `.demo-phone-content` (position: relative).
 */
export default function DemoParticipant({ room, userId }: { room: string; userId: string }) {
  const [background, setBackground] = useState<ReactionRegion>(null);
  const [touchPos, setTouchPos] = useState<{ x: number; y: number } | null>(null);
  const reactionStateRef = useRef<ReactionRegion>(null);

  return (
    <>
      <div className="reaction-label reaction-label-positive" style={reactionLabelStyle(DEFAULT_ANCHORS.positive)}>{LABELS.positive}</div>
      <div className="reaction-label reaction-label-negative" style={reactionLabelStyle(DEFAULT_ANCHORS.negative)}>{LABELS.negative}</div>
      <div className="reaction-label reaction-label-neutral" style={reactionLabelStyle(DEFAULT_ANCHORS.neutral)}>{LABELS.neutral}</div>
      <Canvas
        room={room}
        userId={userId}
        autoSize
        colorCursorsByVote
        currentReactionState={background}
      />
      {/* Own cursor: Canvas filters your own dot, so (like the real app) show a
          larger blue self-indicator at your local pointer position. */}
      {touchPos && (
        <div className="v2-touch-indicator" style={{ left: touchPos.x, top: touchPos.y }} />
      )}
      <TouchLayer
        room={room}
        userId={userId}
        autoSize
        anchors={DEFAULT_ANCHORS}
        reactionStateRef={reactionStateRef}
        onActiveStatementChange={() => {}}
        onReactionStateChange={() => {}}
        onBackgroundColorChange={setBackground}
        onTouchPosition={setTouchPos}
      />
    </>
  );
}
