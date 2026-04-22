import { useState, useMemo } from "react";
import { DEFAULT_ANCHORS } from "../../../utils/voteRegion";
import type { ReactionAnchors } from "../../../utils/voteRegion";
import { anchorToLocal } from "../types";
import type PartySocket from "partysocket";

export function useAnchors(socket: PartySocket) {
  const defaults = anchorToLocal(DEFAULT_ANCHORS);
  const [positiveX, setPositiveX] = useState(defaults.positiveX);
  const [positiveY, setPositiveY] = useState(defaults.positiveY);
  const [negativeX, setNegativeX] = useState(defaults.negativeX);
  const [negativeY, setNegativeY] = useState(defaults.negativeY);
  const [neutralX,  setNeutralX]  = useState(defaults.neutralX);
  const [neutralY,  setNeutralY]  = useState(defaults.neutralY);

  const activeAnchors = useMemo<ReactionAnchors>(() => ({
    positive: { x: parseFloat(positiveX), y: parseFloat(positiveY) },
    negative: { x: parseFloat(negativeX), y: parseFloat(negativeY) },
    neutral:  { x: parseFloat(neutralX),  y: parseFloat(neutralY)  },
  }), [positiveX, positiveY, negativeX, negativeY, neutralX, neutralY]);

  const applyServerAnchors = (anchors: ReactionAnchors | null) => {
    const resolved = anchors ?? DEFAULT_ANCHORS;
    const local = anchorToLocal(resolved);
    setPositiveX(local.positiveX);
    setPositiveY(local.positiveY);
    setNegativeX(local.negativeX);
    setNegativeY(local.negativeY);
    setNeutralX(local.neutralX);
    setNeutralY(local.neutralY);
  };

  const sendAnchors = () => {
    const anchors: ReactionAnchors = {
      positive: { x: parseFloat(positiveX), y: parseFloat(positiveY) },
      negative: { x: parseFloat(negativeX), y: parseFloat(negativeY) },
      neutral:  { x: parseFloat(neutralX),  y: parseFloat(neutralY)  },
    };
    socket.send(JSON.stringify({ type: 'setRoomAnchors', anchors }));
  };

  const resetAnchors = () => {
    applyServerAnchors(null);
    socket.send(JSON.stringify({ type: 'setRoomAnchors', anchors: null }));
  };

  const handleSocketEvent = (data: Record<string, unknown>) => {
    if (data.type === 'roomAnchorsChanged') {
      applyServerAnchors((data.anchors as ReactionAnchors | null) ?? null);
    }
  };

  return {
    positiveX, setPositiveX,
    positiveY, setPositiveY,
    negativeX, setNegativeX,
    negativeY, setNegativeY,
    neutralX,  setNeutralX,
    neutralY,  setNeutralY,
    activeAnchors,
    applyServerAnchors,
    sendAnchors,
    resetAnchors,
    handleSocketEvent,
  };
}
