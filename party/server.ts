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

interface Vote {
  userId: string;
  statementId: number;
  vote: number; // +1 for agree, -1 for disagree, 0 for pass
  timestamp: number;
}

type ClientEvent = CursorEvent | StatementEvent | QueueStatementEvent | ClearQueueEvent;

export default class Server implements Party.Server {
  private activeStatementId: number = 1; // Default to statement 1
  private allSelectedStatements: QueueItem[] = []; // All statements that have been selected
  private votes: Vote[] = []; // Store all votes

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
    // Check if the current active statement is -1 (End Voting)
    const now = Date.now();
    const currentActiveStatement = this.getCurrentActiveStatementId();

    let displayTimestamp: number;
    if (currentActiveStatement === -1) {
      // If active statement is -1, add new statement immediately
      displayTimestamp = now;
    } else {
      // Otherwise, use the normal 10-second delay
      displayTimestamp = now + 10000; // 10 seconds from now
    }

    const queueItem: QueueItem = { statementId, displayTimestamp };

    this.allSelectedStatements.push(queueItem);

    // Broadcast queue update
    this.room.broadcast(JSON.stringify({
      type: 'queueUpdated',
      allSelectedStatements: this.allSelectedStatements,
      currentTime: Date.now()
    }));
  }

  private getCurrentActiveStatementId(): number {
    const now = Date.now();
    // Find the most recent statement that should be displayed
    const displayedStatements = this.allSelectedStatements
      .filter(item => item.displayTimestamp <= now)
      .sort((a, b) => b.displayTimestamp - a.displayTimestamp);

    if (displayedStatements.length > 0) {
      return displayedStatements[0].statementId;
    }

    // Default to statement 1 if no statements have been queued yet
    return 1;
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


  async onRequest(request: Party.Request) {
    const url = new URL(request.url);
    console.log(`[VOTE] Incoming request: ${request.method} ${url.pathname}`);

    if (request.method === "POST" && url.pathname.endsWith("/vote")) {
      console.log(`[VOTE] Processing vote submission...`);
      try {
        const voteData = await request.json<Vote>();
        console.log(`[VOTE] Received vote data:`, JSON.stringify(voteData, null, 2));

        // Validate vote data
        if (!voteData.userId || typeof voteData.statementId !== 'number' ||
            typeof voteData.vote !== 'number' || ![-1, 0, 1].includes(voteData.vote)) {
          console.log(`[VOTE] Invalid vote data - validation failed:`, {
            hasUserId: !!voteData.userId,
            statementIdType: typeof voteData.statementId,
            voteType: typeof voteData.vote,
            voteValue: voteData.vote,
            isValidVoteValue: [-1, 0, 1].includes(voteData.vote)
          });
          return new Response("Invalid vote data", { status: 400 });
        }

        // Add timestamp if not provided
        if (!voteData.timestamp) {
          voteData.timestamp = Date.now();
          console.log(`[VOTE] Added timestamp: ${voteData.timestamp}`);
        }

        // Store the vote
        this.votes.push(voteData);
        console.log(`[VOTE] Vote stored successfully. Total votes: ${this.votes.length}`);
        console.log(`[VOTE] Vote details: User ${voteData.userId} voted ${voteData.vote} (${voteData.vote === 1 ? 'AGREE' : voteData.vote === -1 ? 'DISAGREE' : 'PASS'}) on statement ${voteData.statementId} at ${new Date(voteData.timestamp).toISOString()}`);

        return new Response(JSON.stringify({ success: true, voteCount: this.votes.length }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (error) {
        console.error("[VOTE] Error processing vote:", error);
        console.error("[VOTE] Error stack:", error instanceof Error ? error.stack : 'No stack trace');
        return new Response("Error processing vote", { status: 500 });
      }
    }

    if (request.method === "GET" && url.pathname.endsWith("/votes")) {
      console.log(`[VOTE] Retrieving votes for admin panel. Total votes: ${this.votes.length}`);
      // Return all votes for admin panel
      return new Response(JSON.stringify(this.votes), {
        headers: { "Content-Type": "application/json" }
      });
    }

    if (request.method === "DELETE" && url.pathname.endsWith("/votes")) {
      console.log(`[VOTE] Clearing all votes. Previous count: ${this.votes.length}`);
      // Clear all votes
      this.votes = [];
      console.log(`[VOTE] All votes cleared successfully`);
      return new Response(JSON.stringify({ success: true, message: "All votes cleared" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // Default response
    console.log(`[VOTE] Default response for ${request.method} ${url.pathname}`);
    return new Response("Cursor tracking server is running", {
      headers: { "Content-Type": "text/plain" }
    });
  }
}

Server satisfies Party.Worker;
