import type * as Party from "partykit/server";
import { createNoise2D } from 'simplex-noise';

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

interface GhostCursorSettingEvent {
  type: 'setGhostCursors';
  enabled: boolean;
}

interface Vote {
  userId: string;
  statementId: number;
  vote: number; // +1 for agree, -1 for disagree, 0 for pass
  timestamp: number;
}

type ClientEvent = CursorEvent | StatementEvent | QueueStatementEvent | ClearQueueEvent | GhostCursorSettingEvent;

export default class Server implements Party.Server {
  private activeStatementId: number = 1; // Default to statement 1
  private allSelectedStatements: QueueItem[] = []; // All statements that have been selected
  private votes: Vote[] = []; // Store all votes
  private ghostCursorsEnabled: boolean = false; // Ghost cursor setting
  private ghostCursors: Array<{
    id: string;
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    isMoving: boolean;
    moveStartTime: number;
    moveDuration: number;
    voteArea: { x: number; y: number }; // Current vote area for random motion
    noiseOffsetX: number; // Unique noise offset for X axis
    noiseOffsetY: number; // Unique noise offset for Y axis
    restingSpeed: number; // Individual resting movement speed multiplier
    restingRadius: number; // Individual resting movement radius
    transitionStartTime: number; // When transition to resting began
    transitionDuration: number; // How long the transition takes
    finalMovePosition: { x: number; y: number }; // Position when movement ended
  }> = [];
  private ghostCursorInterval?: NodeJS.Timeout;
  private noise2D = createNoise2D();

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
      currentTime: Date.now(),
      ghostCursorsEnabled: this.ghostCursorsEnabled
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
      } else if (event.type === 'setGhostCursors') {
        // Handle ghost cursor setting changes
        console.log(`Ghost cursor setting from ${sender.id}:`, event.enabled);
        this.setGhostCursorsEnabled(event.enabled);
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

  private setGhostCursorsEnabled(enabled: boolean) {
    this.ghostCursorsEnabled = enabled;

    if (enabled) {
      this.initializeGhostCursors();
      this.startGhostCursorAnimation();
    } else {
      this.stopGhostCursorAnimation();
      // Send remove events for all current ghost cursors
      this.ghostCursors.forEach(cursor => {
        this.room.broadcast(JSON.stringify({
          type: 'remove',
          position: {
            x: 0,
            y: 0,
            timestamp: Date.now(),
            userId: cursor.id,
          }
        }));
      });
      this.ghostCursors = [];
    }

    // Broadcast the ghost cursor setting change to all connections
    this.room.broadcast(JSON.stringify({
      type: 'ghostCursorsChanged',
      enabled: this.ghostCursorsEnabled
    }));
  }

  private generateRandomUserId(): string {
    // Generate a random user ID similar to real users (9 characters)
    return Math.random().toString(36).substr(2, 9);
  }

  private initializeGhostCursors() {
    this.ghostCursors = [];

    // Define vote areas (normalized coordinates 0-100)
    const voteAreas = [
      { x: 97, y: 8 },   // AGREE: top-right
      { x: 3, y: 85 },   // DISAGREE: bottom-left
      { x: 97, y: 85 }   // PASS: bottom-right
    ];

    for (let i = 0; i < 10; i++) {
      // Start from random edge positions
      const side = Math.floor(Math.random() * 4);
      let startX, startY;

      switch (side) {
        case 0: // top
          startX = Math.random() * 100;
          startY = -5;
          break;
        case 1: // right
          startX = 105;
          startY = Math.random() * 100;
          break;
        case 2: // bottom
          startX = Math.random() * 100;
          startY = 105;
          break;
        case 3: // left
        default:
          startX = -5;
          startY = Math.random() * 100;
          break;
      }

      const targetArea = voteAreas[Math.floor(Math.random() * voteAreas.length)];

      // Generate individual resting characteristics
      // Most cursors (70%) will have slow movement, some (30%) will have faster movement
      const isActiveCursor = Math.random() < 0.3;
      const restingSpeed = isActiveCursor ?
        0.8 + Math.random() * 0.7 : // Active cursors: 0.8-1.5x speed
        0.2 + Math.random() * 0.4;  // Most cursors: 0.2-0.6x speed

      const restingRadius = isActiveCursor ?
        4 + Math.random() * 4 : // Active cursors: 4-8% radius
        2 + Math.random() * 3;  // Most cursors: 2-5% radius

      this.ghostCursors.push({
        id: this.generateRandomUserId(),
        x: startX,
        y: startY,
        targetX: targetArea.x,
        targetY: targetArea.y,
        isMoving: true,
        moveStartTime: Date.now() + Math.random() * 2000, // Stagger start times
        moveDuration: 3000 + Math.random() * 2000, // 3-5 seconds to reach target
        voteArea: { x: targetArea.x, y: targetArea.y },
        noiseOffsetX: Math.random() * 1000, // Unique noise offset for each cursor
        noiseOffsetY: Math.random() * 1000,
        restingSpeed: restingSpeed,
        restingRadius: restingRadius,
        transitionStartTime: 0,
        transitionDuration: 2000, // 2 second transition to resting motion
        finalMovePosition: { x: startX, y: startY }
      });
    }
  }

  private startGhostCursorAnimation() {
    if (this.ghostCursorInterval) {
      clearInterval(this.ghostCursorInterval);
    }

    this.ghostCursorInterval = setInterval(() => {
      this.checkForStatementChanges();
      this.updateGhostCursors();
    }, 100); // Update every 100ms for smooth animation
  }

  private stopGhostCursorAnimation() {
    if (this.ghostCursorInterval) {
      clearInterval(this.ghostCursorInterval);
      this.ghostCursorInterval = undefined;
    }
  }

  private updateGhostCursors() {
    if (!this.ghostCursorsEnabled) return;

    const now = Date.now();

    this.ghostCursors.forEach(cursor => {
      if (cursor.isMoving && now >= cursor.moveStartTime) {
        const elapsed = now - cursor.moveStartTime;
        const progress = Math.min(elapsed / cursor.moveDuration, 1);

        // Use easing function for more natural movement
        const easeProgress = this.easeInOutCubic(progress);

        // Interpolate position
        cursor.x = cursor.x + (cursor.targetX - cursor.x) * easeProgress * 0.1;
        cursor.y = cursor.y + (cursor.targetY - cursor.y) * easeProgress * 0.1;

        // Check if reached target
        const distanceToTarget = Math.sqrt(
          Math.pow(cursor.targetX - cursor.x, 2) +
          Math.pow(cursor.targetY - cursor.y, 2)
        );

        if (distanceToTarget < 2 || progress >= 1) {
          cursor.isMoving = false;
          // Start transition to resting motion
          cursor.transitionStartTime = now;
          cursor.finalMovePosition = { x: cursor.x, y: cursor.y };
          cursor.voteArea = { x: cursor.x, y: cursor.y };
        }
      } else if (!cursor.isMoving) {
        // Handle transition from movement to resting motion
        const transitionElapsed = now - cursor.transitionStartTime;
        const transitionProgress = Math.min(transitionElapsed / cursor.transitionDuration, 1);

        // Generate noise-based target position
        const time = now * 0.0005 * cursor.restingSpeed;
        const noiseX = this.noise2D(cursor.noiseOffsetX, time);
        const noiseY = this.noise2D(cursor.noiseOffsetY, time);
        const noiseTargetX = cursor.voteArea.x + (noiseX * cursor.restingRadius);
        const noiseTargetY = cursor.voteArea.y + (noiseY * cursor.restingRadius);

        if (transitionProgress < 1) {
          // During transition: blend from final move position to noise position
          const easeProgress = this.easeInOutCubic(transitionProgress);
          cursor.x = cursor.finalMovePosition.x + (noiseTargetX - cursor.finalMovePosition.x) * easeProgress;
          cursor.y = cursor.finalMovePosition.y + (noiseTargetY - cursor.finalMovePosition.y) * easeProgress;
        } else {
          // After transition: use pure noise motion
          cursor.x = noiseTargetX;
          cursor.y = noiseTargetY;
        }

        // Ensure cursors stay within canvas bounds
        cursor.x = Math.max(0, Math.min(100, cursor.x));
        cursor.y = Math.max(0, Math.min(100, cursor.y));
      }

      // Always broadcast cursor position to prevent 3-second timeout removal
      this.room.broadcast(JSON.stringify({
        type: 'move',
        position: {
          x: Math.max(0, Math.min(100, cursor.x)),
          y: Math.max(0, Math.min(100, cursor.y)),
          timestamp: now,
          userId: cursor.id,
        }
      }));
    });
  }

  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  private moveGhostCursorsToNewTargets() {
    if (!this.ghostCursorsEnabled) return;

    const voteAreas = [
      { x: 97, y: 8 },   // AGREE: top-right
      { x: 3, y: 85 },   // DISAGREE: bottom-left
      { x: 97, y: 85 }   // PASS: bottom-right
    ];

    // Calculate the time until the next statement
    const now = Date.now();
    const nextStatement = this.allSelectedStatements
      .filter(item => item.displayTimestamp > now)
      .sort((a, b) => a.displayTimestamp - b.displayTimestamp)[0];

    // Default to 10 seconds if no next statement (standard statement duration)
    const timeUntilNext = nextStatement ? nextStatement.displayTimestamp - now : 10000;

    this.ghostCursors.forEach(cursor => {
      const newTarget = voteAreas[Math.floor(Math.random() * voteAreas.length)];
      cursor.targetX = newTarget.x;
      cursor.targetY = newTarget.y;
      cursor.isMoving = true;

      // Random delay from 0 to 20% of statement duration before starting to move
      const maxStartDelay = timeUntilNext * 0.2;
      const startDelay = Math.random() * maxStartDelay;
      cursor.moveStartTime = now + startDelay;

      // Finish moving 0 to 20% of total time before the next statement
      const maxEarlyFinish = timeUntilNext * 0.2;
      const earlyFinish = Math.random() * maxEarlyFinish;
      const availableMoveDuration = timeUntilNext - startDelay - earlyFinish;

      // Ensure minimum movement duration of 1 second
      cursor.moveDuration = Math.max(1000, availableMoveDuration);

      // The vote area will be updated when the cursor reaches its target
    });
  }

  private lastActiveStatementId: number = 1;

  private checkForStatementChanges() {
    if (!this.ghostCursorsEnabled) return;

    const currentActiveId = this.getCurrentActiveStatementId();
    if (currentActiveId !== this.lastActiveStatementId) {
      console.log(`Statement changed from ${this.lastActiveStatementId} to ${currentActiveId}, moving ghost cursors`);
      this.lastActiveStatementId = currentActiveId;
      this.moveGhostCursorsToNewTargets();
    }
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
