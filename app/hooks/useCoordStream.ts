import { useEffect, useRef, useState } from 'react';
import { useMessageSubscription } from '../contexts/RoomSocketContext';
import { expandCursorEvents, CURSOR_STALE_MS } from '../utils/cursor';

export type CoordStreamStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface CoordStreamResult {
  /** Per-frame readable. Safe to read in a RAF loop without triggering re-renders. */
  positionsRef: React.MutableRefObject<Map<string, { x: number; y: number }>>;
  /**
   * Per-frame readable set of userIds currently connected to the room —
   * independent of `positionsRef`, which only holds users with an active
   * cursor/touch. A user stays in this set from the moment their connection
   * is established (server's `connected`/`userJoined` messages) until they
   * disconnect (`userLeft`), regardless of whether they're actively touching.
   */
  connectedRef: React.MutableRefObject<Set<string>>;
  /** Connection status — useful for overlays in standalone contexts. */
  status?: CoordStreamStatus;
}

/** Applies a `connected`/`userJoined`/`userLeft` message to a connected-users set. */
function applyConnectionEvent(
  data: { type?: string; connectedUserIds?: string[]; userId?: string },
  connectedRef: React.MutableRefObject<Set<string>>,
): void {
  if (data.type === 'connected') {
    for (const id of data.connectedUserIds ?? []) connectedRef.current.add(id);
  } else if (data.type === 'userJoined' && data.userId) {
    connectedRef.current.add(data.userId);
  } else if (data.type === 'userLeft' && data.userId) {
    connectedRef.current.delete(data.userId);
  }
}


/** Options shared by both coord-stream hooks. */
export interface CoordStreamOptions {
  /**
   * Include your own cursor in the positions map. Defaults to false (self is
   * filtered out). Set true for presentation vizzes (e.g. boids) where you want
   * your own cursor to drive the effect from a single tab.
   */
  includeSelf?: boolean;
}

/**
 * Extracts the coord-stream data spine out of CursorField.
 * Subscribes to the room socket, writes other participants' positions into a
 * ref (never React state), and expires stale cursors after CURSOR_STALE_MS.
 * Skips own userId so self is never included in the positions map, unless
 * `includeSelf` is set.
 */
export function useCoordStream(ownUserId: string, opts?: CoordStreamOptions): CoordStreamResult {
  const includeSelf = opts?.includeSelf ?? false;
  const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  // Tracks the last-seen timestamp per user for expiry.
  const timestampsRef = useRef<Map<string, number>>(new Map());
  // Server never tells you about yourself (connected/userJoined exclude the
  // sender), so seed self in directly when included.
  const connectedRef = useRef<Set<string>>(new Set(includeSelf ? [ownUserId] : []));

  useMessageSubscription((evt: MessageEvent) => {
    let data: unknown;
    try { data = JSON.parse(evt.data); } catch { return; }
    if (!data || typeof data !== 'object') return;

    applyConnectionEvent(data as { type?: string; connectedUserIds?: string[]; userId?: string }, connectedRef);

    for (const event of expandCursorEvents(data as Parameters<typeof expandCursorEvents>[0])) {
      const { userId, x, y } = event.position;
      if (!includeSelf && userId === ownUserId) continue;

      if (event.type === 'remove') {
        positionsRef.current.delete(userId);
        timestampsRef.current.delete(userId);
        continue;
      }

      // A position event proves this user is connected even if this
      // subscriber missed the one-time `connected` snapshot — e.g. it joined
      // the shared room socket (RoomSocketProvider) after the socket had
      // already been open for a while, so the snapshot fired before this
      // consumer subscribed.
      connectedRef.current.add(userId);
      positionsRef.current.set(userId, { x, y });
      const ts = Date.now();
      timestampsRef.current.set(userId, ts);

      // Expire this position if no newer message arrives within CURSOR_STALE_MS.
      setTimeout(() => {
        if (timestampsRef.current.get(userId) === ts) {
          positionsRef.current.delete(userId);
          timestampsRef.current.delete(userId);
        }
      }, CURSOR_STALE_MS);
    }
  });

  return { positionsRef, connectedRef };
}

/**
 * Standalone coord stream backed by a raw WebSocket URL — for use outside
 * RoomSocketProvider (e.g. Storybook live-room stories, perf harnesses).
 * Accepts a PartyKit room URL (http or https) like:
 *   https://whispering-gallery.patcon.partykit.dev/default
 *   http://localhost:1999/default
 * Maps http→ws and https→wss — TLS is a server concern, not a WebSocket one.
 */
export function useRawCoordStream(
  roomUrl: string | null,
  ownUserId: string,
  opts?: CoordStreamOptions,
): CoordStreamResult {
  const includeSelf = opts?.includeSelf ?? false;
  const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const timestampsRef = useRef<Map<string, number>>(new Map());
  const connectedRef = useRef<Set<string>>(new Set(includeSelf ? [ownUserId] : []));
  const [status, setStatus] = useState<CoordStreamStatus>('connecting');

  useEffect(() => {
    if (!roomUrl) return;

    // Parse http(s)://host/room → ws(s)://host/parties/main/room
    // Mirror the input protocol: http→ws, https→wss. Whether to use TLS is a
    // server concern (does it run on HTTPS?), not a WebSocket constraint.
    let parsed: URL;
    try { parsed = new URL(roomUrl); } catch { return; }
    const wsProtocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = parsed.host;
    const room = parsed.pathname.replace(/^\//, '') || 'default';
    const params = new URLSearchParams({ userId: ownUserId });
    const wsUrl = `${wsProtocol}//${host}/parties/main/${room}?${params}`;

    // Use native WebSocket directly: explicit URL, no heuristics, synchronous
    // construction so the cleanup closure reliably captures it.
    const ws = new WebSocket(wsUrl);
    setStatus('connecting');

    ws.addEventListener('open', () => setStatus('connected'));
    ws.addEventListener('close', () => setStatus('disconnected'));
    ws.addEventListener('error', () => setStatus('error'));

    ws.addEventListener('message', (evt: MessageEvent) => {
      let data: unknown;
      try { data = JSON.parse(evt.data); } catch { return; }
      if (!data || typeof data !== 'object') return;

      applyConnectionEvent(data as { type?: string; connectedUserIds?: string[]; userId?: string }, connectedRef);

      for (const event of expandCursorEvents(data as Parameters<typeof expandCursorEvents>[0])) {
        const { userId, x, y } = event.position;
        if (!includeSelf && userId === ownUserId) continue;

        if (event.type === 'remove') {
          positionsRef.current.delete(userId);
          timestampsRef.current.delete(userId);
          continue;
        }

        connectedRef.current.add(userId);
        positionsRef.current.set(userId, { x, y });
        const ts = Date.now();
        timestampsRef.current.set(userId, ts);
        setTimeout(() => {
          if (timestampsRef.current.get(userId) === ts) {
            positionsRef.current.delete(userId);
            timestampsRef.current.delete(userId);
          }
        }, CURSOR_STALE_MS);
      }
    });

    return () => {
      ws.close();
      positionsRef.current.clear();
      timestampsRef.current.clear();
      connectedRef.current.clear();
    };
  }, [roomUrl, ownUserId, includeSelf]);

  return { positionsRef, connectedRef, status };
}
