import type * as Party from "partykit/server";

interface CursorPosition {
  x: number;
  y: number;
  timestamp: number;
  userId: string;
}

interface CursorEvent {
  type: 'move' | 'touch' | 'remove';
  position: CursorPosition;
}

interface StatementEvent {
  type: 'setActiveStatement';
  statementId: number;
}

type ClientEvent = CursorEvent | StatementEvent;

export default class Server implements Party.Server {
  private activeStatementId: number = 1; // Default to statement 1

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    // A websocket just connected!
    console.log(
      `Connected:
  id: ${conn.id}
  room: ${this.room.id}
  url: ${new URL(ctx.request.url).pathname}`
    );

    // Send welcome message with current active statement
    conn.send(JSON.stringify({
      type: 'connected',
      connectionId: conn.id,
      activeStatementId: this.activeStatementId
    }));
  }

  onMessage(message: string, sender: Party.Connection) {
    try {
      const event: ClientEvent = JSON.parse(message);

      if ('position' in event) {
        // Handle cursor events
        console.log(`Cursor event from ${sender.id}:`, event.type, event.position);
        // Broadcast the cursor event to all other connections
        this.room.broadcast(message, [sender.id]);
      } else if (event.type === 'setActiveStatement') {
        // Handle statement change events
        console.log(`Statement change from ${sender.id}:`, event.statementId);
        this.activeStatementId = event.statementId;
        // Broadcast the statement change to all connections
        this.room.broadcast(JSON.stringify({
          type: 'activeStatementChanged',
          statementId: this.activeStatementId
        }));
      }
    } catch (e) {
      console.error('Failed to parse event:', e);
    }
  }

  onRequest(req: Party.Request) {
    // Handle HTTP requests if needed
    return new Response("Cursor tracking server is running", {
      headers: { "Content-Type": "text/plain" }
    });
  }
}

Server satisfies Party.Worker;
