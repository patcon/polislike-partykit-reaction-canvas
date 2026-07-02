import { useRef } from 'react';
import { useMessageSubscription } from '../contexts/RoomSocketContext';
import { useCoordStream, type CoordStreamOptions } from './useCoordStream';
import {
  computeCursorValence,
  computeReactionRegion,
  DEFAULT_ANCHORS,
  type ReactionAnchors,
} from '../utils/voteRegion';

export type ValenceMode = 'continuous' | 'unit';

export interface ValenceStreamOptions extends CoordStreamOptions {
  /**
   * `continuous` → weighted-centroid valence (computeCursorValence), a smooth
   * float in −1..1. `unit` → the argmax reaction region snapped to {−1, 0, +1}
   * (computeReactionRegion). Defaults to `continuous`.
   *
   * NOTE: unit mode is NOT a quantization of the continuous value — the two
   * disagree at region boundaries (see voteRegion tests), so it must go through
   * computeReactionRegion's barycentric argmax.
   */
  mode?: ValenceMode;
}

export interface ValenceStreamResult {
  /** Per-frame readable. Values in −1..1. Safe to read in a RAF loop / poll. */
  valencesRef: React.MutableRefObject<Map<string, number>>;
}

const REGION_VALENCE: Record<'positive' | 'neutral' | 'negative', number> = {
  positive: 1,
  neutral: 0,
  negative: -1,
};

/**
 * Thin projection layered on useCoordStream: turns each cursor's {x,y} into a
 * signed valence in −1..1. useCoordStream stays the anchor-agnostic transport
 * (socket → positionsRef, with expiry + includeSelf filtering); this hook owns
 * only the geometry — the anchors and the projection.
 *
 * valencesRef is rebuilt from positionsRef on every cursor/anchor message
 * (eager compute-on-write; useCoordStream's subscription is registered first,
 * so positionsRef is already fresh when we recompute). Anchor changes recompute
 * too, so colors/tones follow a live anchor edit without waiting for a move.
 */
export function useValenceStream(ownUserId: string, opts?: ValenceStreamOptions): ValenceStreamResult {
  const mode = opts?.mode ?? 'continuous';
  const { positionsRef } = useCoordStream(ownUserId, { includeSelf: opts?.includeSelf });
  const valencesRef = useRef<Map<string, number>>(new Map());
  const anchorsRef = useRef<ReactionAnchors>(DEFAULT_ANCHORS);

  function projectValence(x: number, y: number): number {
    if (mode === 'unit') {
      const region = computeReactionRegion(x, y, anchorsRef.current);
      return region ? REGION_VALENCE[region] : 0;
    }
    return computeCursorValence(x, y, anchorsRef.current);
  }

  function recompute() {
    const next = valencesRef.current;
    next.clear();
    for (const [userId, pos] of positionsRef.current) {
      next.set(userId, projectValence(pos.x, pos.y));
    }
  }

  useMessageSubscription((evt: MessageEvent) => {
    let data: { type?: string; roomAnchors?: ReactionAnchors; anchors?: ReactionAnchors };
    try { data = JSON.parse(evt.data); } catch { return; }
    if (!data || typeof data !== 'object') return;

    switch (data.type) {
      case 'connected':
        if (data.roomAnchors) anchorsRef.current = data.roomAnchors;
        recompute();
        break;
      case 'roomAnchorsChanged':
        anchorsRef.current = data.anchors ?? DEFAULT_ANCHORS;
        recompute();
        break;
      case 'move':
      case 'touch':
      case 'remove':
      case 'cursorBatch':
        recompute();
        break;
    }
  });

  return { valencesRef };
}
