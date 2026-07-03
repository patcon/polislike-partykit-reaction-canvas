import { useCallback, useRef } from 'react';
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
  /**
   * Projects the CURRENT cursor positions into per-user valence (−1..1) on
   * demand. Reads positionsRef live on every call, so a cursor that expired
   * silently — useCoordStream's CURSOR_STALE_MS timeout prunes positionsRef
   * without emitting any socket message — is simply absent the next time you
   * call. There is no message-time cache to go stale, so mood/colors decay as
   * soon as the underlying cursor does. Safe to call in a poll / RAF loop /
   * repaint.
   *
   * Returns a REUSED Map (cleared and refilled each call) to avoid per-frame
   * allocation. Read it immediately; copy it if you need to retain it past the
   * next call.
   */
  getValences: () => Map<string, number>;
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
 * The projection is compute-on-read (getValences), not a cache: consumers call
 * it from their own poll/RAF/repaint and get valences derived from positionsRef
 * as it stands right now. That keeps it in lockstep with cursor expiry — a
 * silently-timed-out cursor (no socket message) drops out on the next read
 * rather than lingering until the next message rebuilds a cache.
 */
export function useValenceStream(ownUserId: string, opts?: ValenceStreamOptions): ValenceStreamResult {
  const mode = opts?.mode ?? 'continuous';
  const { positionsRef } = useCoordStream(ownUserId, { includeSelf: opts?.includeSelf });
  const anchorsRef = useRef<ReactionAnchors>(DEFAULT_ANCHORS);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const valencesRef = useRef<Map<string, number>>(new Map());

  // The hook owns the anchors: keep them synced from the socket so getValences
  // projects against live room geometry. Cursor messages need no handling here —
  // getValences reads positionsRef (which useCoordStream keeps current) on call.
  useMessageSubscription((evt: MessageEvent) => {
    let data: { type?: string; roomAnchors?: ReactionAnchors; anchors?: ReactionAnchors };
    try { data = JSON.parse(evt.data); } catch { return; }
    if (!data || typeof data !== 'object') return;

    if (data.type === 'connected') {
      if (data.roomAnchors) anchorsRef.current = data.roomAnchors;
    } else if (data.type === 'roomAnchorsChanged') {
      anchorsRef.current = data.anchors ?? DEFAULT_ANCHORS;
    }
  });

  const getValences = useCallback((): Map<string, number> => {
    const out = valencesRef.current;
    out.clear();
    const anchors = anchorsRef.current;
    const unit = modeRef.current === 'unit';
    for (const [userId, pos] of positionsRef.current) {
      if (unit) {
        const region = computeReactionRegion(pos.x, pos.y, anchors);
        out.set(userId, region ? REGION_VALENCE[region] : 0);
      } else {
        out.set(userId, computeCursorValence(pos.x, pos.y, anchors));
      }
    }
    return out;
  }, [positionsRef]);

  return { getValences };
}
