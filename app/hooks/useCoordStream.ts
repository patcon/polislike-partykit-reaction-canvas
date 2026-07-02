import { useEffect, useRef } from 'react';
import { useMessageSubscription } from '../contexts/RoomSocketContext';
import { expandCursorEvents } from '../utils/cursor';

export interface CoordStreamResult {
  /** Per-frame readable. Safe to read in a RAF loop without triggering re-renders. */
  positionsRef: React.MutableRefObject<Map<string, { x: number; y: number }>>;
}

const STALE_MS = 3000;

/**
 * Extracts the coord-stream data spine out of CursorField.
 * Subscribes to the room socket, writes other participants' positions into a
 * ref (never React state), and expires stale cursors after STALE_MS.
 * Skips own userId so self is never included in the positions map.
 */
export function useCoordStream(ownUserId: string): CoordStreamResult {
  const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  // Tracks the last-seen timestamp per user for expiry.
  const timestampsRef = useRef<Map<string, number>>(new Map());

  useMessageSubscription((evt: MessageEvent) => {
    let data: unknown;
    try { data = JSON.parse(evt.data); } catch { return; }
    if (!data || typeof data !== 'object') return;

    for (const event of expandCursorEvents(data as Parameters<typeof expandCursorEvents>[0])) {
      const { userId, x, y } = event.position;
      if (userId === ownUserId) continue;

      if (event.type === 'remove') {
        positionsRef.current.delete(userId);
        timestampsRef.current.delete(userId);
        continue;
      }

      positionsRef.current.set(userId, { x, y });
      const ts = Date.now();
      timestampsRef.current.set(userId, ts);

      // Expire this position if no newer message arrives within STALE_MS.
      setTimeout(() => {
        if (timestampsRef.current.get(userId) === ts) {
          positionsRef.current.delete(userId);
          timestampsRef.current.delete(userId);
        }
      }, STALE_MS);
    }
  });

  return { positionsRef };
}

/**
 * Standalone coord stream backed by a raw WebSocket URL — for use outside
 * RoomSocketProvider (e.g. Storybook live-room stories, perf harnesses).
 * Accepts a PartyKit room URL like:
 *   http://whispering-gallery.patcon.partykit.dev/default
 * and opens a direct WebSocket connection.
 */
export function useRawCoordStream(
  roomUrl: string | null,
  ownUserId: string,
): CoordStreamResult {
  const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const timestampsRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!roomUrl) return;

    // Parse http(s)://host/room  →  wss://host/parties/main/room
    let parsed: URL;
    try { parsed = new URL(roomUrl); } catch { return; }
    const host = parsed.host;
    const room = parsed.pathname.replace(/^\//, '') || 'default';
    const wsUrl = `wss://${host}/parties/main/${room}`;

    // Use PartySocket from 'partysocket' (not 'partysocket/react') so
    // Storybook's mock alias doesn't intercept it.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ws: any = null;
    import('partysocket').then(({ PartySocket }) => {
      ws = new PartySocket({ host, room, party: 'main', query: { userId: ownUserId } });

      ws.addEventListener('message', (evt: MessageEvent) => {
        let data: unknown;
        try { data = JSON.parse(evt.data); } catch { return; }
        if (!data || typeof data !== 'object') return;

        for (const event of expandCursorEvents(data as Parameters<typeof expandCursorEvents>[0])) {
          const { userId, x, y } = event.position;
          if (userId === ownUserId) continue;

          if (event.type === 'remove') {
            positionsRef.current.delete(userId);
            timestampsRef.current.delete(userId);
            continue;
          }

          positionsRef.current.set(userId, { x, y });
          const ts = Date.now();
          timestampsRef.current.set(userId, ts);
          setTimeout(() => {
            if (timestampsRef.current.get(userId) === ts) {
              positionsRef.current.delete(userId);
              timestampsRef.current.delete(userId);
            }
          }, STALE_MS);
        }
      });

      void wsUrl; // documents intent; actual connection is via PartySocket opts above
    });

    return () => { ws?.close(); positionsRef.current.clear(); timestampsRef.current.clear(); };
  }, [roomUrl, ownUserId]);

  return { positionsRef };
}
