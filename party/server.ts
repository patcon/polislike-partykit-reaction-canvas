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

interface QueueItem {
  statementId: number;
  displayTimestamp: number; // timestamp when this should become active
}

interface StatementEvent {
  type: 'setActiveStatement';
  statementId: number;
}

interface QueueStatementEvent {
  type: 'queueStatement';
  statementId: number;
}

interface ClearQueueEvent {
  type: 'clearQueue';
}

type ClientEvent = CursorEvent | StatementEvent | QueueStatementEvent | ClearQueueEvent;

export default class Server implements Party.Server {
  private activeStatementId: number = 1; // Default to statement 1
  private allSelectedStatements: QueueItem[] = []; // All statements that have been selected

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    // A websocket just connected!
    console.log(
      `Connected:
  id: ${conn.id}
  room: ${this.room.id}
  url: ${new URL(ctx.request.url).pathname}`
    );

    // Send welcome message with current active statement and queue info
    conn.send(JSON.stringify({
      type: 'connected',
      connectionId: conn.id,
      activeStatementId: this.activeStatementId,
      allSelectedStatements: this.allSelectedStatements,
      currentTime: Date.now()
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
        // Handle immediate statement change events (legacy support)
        console.log(`Statement change from ${sender.id}:`, event.statementId);
        this.activeStatementId = event.statementId;
        // Broadcast the statement change to all connections
        this.room.broadcast(JSON.stringify({
          type: 'activeStatementChanged',
          statementId: this.activeStatementId
        }));
      } else if (event.type === 'queueStatement') {
        // Handle queuing statement events
        console.log(`Queue statement from ${sender.id}:`, event.statementId);
        this.queueStatement(event.statementId);
      } else if (event.type === 'clearQueue') {
        // Handle clearing the queue
        console.log(`Clear queue from ${sender.id}`);
        this.clearQueue();
      }
    } catch (e) {
      console.error('Failed to parse event:', e);
    }
  }

  private queueStatement(statementId: number) {
    const displayTimestamp = Date.now() + 10000; // 10 seconds from now
    const queueItem: QueueItem = { statementId, displayTimestamp };

    this.allSelectedStatements.push(queueItem);

    // Broadcast queue update
    this.room.broadcast(JSON.stringify({
      type: 'queueUpdated',
      allSelectedStatements: this.allSelectedStatements,
      currentTime: Date.now()
    }));
  }

  private clearQueue() {
    const now = Date.now();
    
    // Keep only the currently active statement (most recent past statement)
    // Remove all future queued statements
    const pastStatements = this.allSelectedStatements
      .filter(item => item.displayTimestamp <= now)
      .sort((a, b) => b.displayTimestamp - a.displayTimestamp);
    
    // Keep only the most recent past statement (current active) if it exists
    this.allSelectedStatements = pastStatements.length > 0 ? [pastStatements[0]] : [];

    // Broadcast queue update
    this.room.broadcast(JSON.stringify({
      type: 'queueUpdated',
      allSelectedStatements: this.allSelectedStatements,
      currentTime: Date.now()
    }));
  }


  onRequest(req: Party.Request) {
    // Handle HTTP requests if needed
    return new Response("Cursor tracking server is running", {
      headers: { "Content-Type": "text/plain" }
    });
  }
}

Server satisfies Party.Worker;
