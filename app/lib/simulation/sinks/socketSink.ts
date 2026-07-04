// Sink that pushes simulated cursor events into a live room over the socket.
// The whole tick's worth of events is sent as one `simCursorBatch` message,
// which the server rebroadcasts as a single `cursorBatch` (see party/server.ts),
// so 25-100 sim users cost one client->server message per tick.

import type { CursorEvent, SimSink } from '../types';

/**
 * Build a {@link SimSink} that serializes each batch of cursor events into a
 * `simCursorBatch` message and hands it to `send`.
 *
 * @param send The room socket's imperative send (e.g. `useRoomSocket().send`).
 * @returns A sink whose `emit` no-ops on an empty batch and otherwise sends one
 *   `{ type: 'simCursorBatch', cursors }` message.
 */
export function createSocketSink(send: (message: string) => void): SimSink {
  return {
    emit(events: CursorEvent[]): void {
      if (events.length === 0) return;
      send(JSON.stringify({ type: 'simCursorBatch', cursors: events }));
    },
  };
}
