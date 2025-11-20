import type * as Party from "partykit/server";

interface Point {
  x: number;
  y: number;
  timestamp: number;
  userId: string;
}

interface CanvasEvent {
  type: 'move' | 'start' | 'end';
  point: Point;
}

export default class Server implements Party.Server {
  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    // A websocket just connected!
    console.log(
      `Connected:
  id: ${conn.id}
  room: ${this.room.id}
  url: ${new URL(ctx.request.url).pathname}`
    );

    // Send welcome message
    conn.send(JSON.stringify({ type: 'connected', connectionId: conn.id }));
  }

  onMessage(message: string, sender: Party.Connection) {
    try {
      const event: CanvasEvent = JSON.parse(message);
      console.log(`Canvas event from ${sender.id}:`, event.type, event.point);
      
      // Broadcast the canvas event to all other connections
      this.room.broadcast(message, [sender.id]);
    } catch (e) {
      console.error('Failed to parse canvas event:', e);
    }
  }

  onRequest(req: Party.Request) {
    // Handle HTTP requests if needed
    return new Response("Canvas server is running", {
      headers: { "Content-Type": "text/plain" }
    });
  }
}

Server satisfies Party.Worker;
