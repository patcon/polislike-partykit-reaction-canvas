import type * as Party from "partykit/server";

interface CursorPosition {
  x: number;
  y: number;
  timestamp: number;
  userId: string;
}

interface CursorEvent {
  type: "move" | "touch" | "remove";
  position: CursorPosition;
}

/**
 * Minimal cursor-only PartyKit server for peak performance testing.
 *
 * Handles only cursor move/touch/remove events and presence count.
 * No statement queue, no admin, no ghost cursors, no Polis proxy.
 * Accessible at: /parties/perf/{roomName}
 */
export default class PerfServer implements Party.Server {
  constructor(readonly room: Party.Room) {}

  private cursorPositions = new Map<string, CursorPosition>();
  private connectionUserMap = new Map<string, string>();

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    const userId = new URL(ctx.request.url).searchParams.get("userId") ?? conn.id;
    this.connectionUserMap.set(conn.id, userId);

    const count = [...this.room.getConnections()].length;
    conn.send(JSON.stringify({ type: "connected", userId, presenceCount: count }));
    this.room.broadcast(
      JSON.stringify({ type: "presenceCount", count }),
      [conn.id],
    );
  }

  onClose(conn: Party.Connection) {
    const userId = this.connectionUserMap.get(conn.id);
    this.connectionUserMap.delete(conn.id);

    if (userId) {
      this.cursorPositions.delete(userId);
      this.room.broadcast(
        JSON.stringify({
          type: "remove",
          position: { x: 0, y: 0, timestamp: Date.now(), userId },
        }),
      );
    }

    const count = [...this.room.getConnections()].length - 1;
    this.room.broadcast(JSON.stringify({ type: "presenceCount", count }));
  }

  onMessage(message: string, sender: Party.Connection) {
    try {
      const event = JSON.parse(message) as CursorEvent;
      if (event.type === "move" || event.type === "touch") {
        this.cursorPositions.set(event.position.userId, event.position);
      } else if (event.type === "remove") {
        this.cursorPositions.delete(event.position.userId);
      }
      this.room.broadcast(message, [sender.id]);
    } catch {
      // ignore malformed messages
    }
  }
}
