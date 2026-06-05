import { createNoise2D } from 'simplex-noise';
import { getCurrentActiveStatementId } from './queueLogic';
import type { QueueItem } from './queueLogic';

interface GhostCursor {
  id: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  isMoving: boolean;
  moveStartTime: number;
  moveDuration: number;
  voteArea: { x: number; y: number };
  noiseOffsetX: number;
  noiseOffsetY: number;
  restingSpeed: number;
  restingRadius: number;
  transitionStartTime: number;
  transitionDuration: number;
  finalMovePosition: { x: number; y: number };
}

const VOTE_AREAS = [
  { x: 70, y: 20 },
  { x: 20, y: 60 },
  { x: 90, y: 70 },
];

export class GhostCursorManager {
  private _enabled = false;
  private cursors: GhostCursor[] = [];
  private interval?: NodeJS.Timeout;
  private noise2D = createNoise2D();
  private lastActiveStatementId = 1;

  constructor(
    private broadcast: (msg: string) => void,
    private getStatements: () => QueueItem[],
  ) {}

  get enabled(): boolean { return this._enabled; }

  setEnabled(enabled: boolean) {
    this._enabled = enabled;
    if (enabled) {
      this.initialize();
      this.startAnimation();
    } else {
      this.stopAnimation();
      this.cursors.forEach(cursor => {
        this.broadcast(JSON.stringify({
          type: 'remove',
          position: { x: 0, y: 0, timestamp: Date.now(), userId: cursor.id },
        }));
      });
      this.cursors = [];
    }
    this.broadcast(JSON.stringify({ type: 'ghostCursorsChanged', enabled: this._enabled }));
  }

  private initialize() {
    this.cursors = [];
    for (let i = 0; i < 10; i++) {
      const side = Math.floor(Math.random() * 4);
      let startX: number, startY: number;
      switch (side) {
        case 0: startX = Math.random() * 100; startY = -5;  break;
        case 1: startX = 105;  startY = Math.random() * 100; break;
        case 2: startX = Math.random() * 100; startY = 105; break;
        default: startX = -5; startY = Math.random() * 100; break;
      }
      const target = VOTE_AREAS[Math.floor(Math.random() * VOTE_AREAS.length)];
      const isActive = Math.random() < 0.3;
      this.cursors.push({
        id: Math.random().toString(36).substr(2, 9),
        x: startX, y: startY,
        targetX: target.x, targetY: target.y,
        isMoving: true,
        moveStartTime: Date.now() + Math.random() * 2000,
        moveDuration: 3000 + Math.random() * 2000,
        voteArea: { x: target.x, y: target.y },
        noiseOffsetX: Math.random() * 1000,
        noiseOffsetY: Math.random() * 1000,
        restingSpeed: isActive ? 0.8 + Math.random() * 0.7 : 0.2 + Math.random() * 0.4,
        restingRadius: isActive ? 4 + Math.random() * 4 : 2 + Math.random() * 3,
        transitionStartTime: 0,
        transitionDuration: 2000,
        finalMovePosition: { x: startX, y: startY },
      });
    }
  }

  private startAnimation() {
    if (this.interval) clearInterval(this.interval);
    this.interval = setInterval(() => {
      this.checkForStatementChanges();
      this.update();
    }, 100);
  }

  private stopAnimation() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }

  private update() {
    if (!this._enabled) return;
    const now = Date.now();
    this.cursors.forEach(cursor => {
      if (cursor.isMoving && now >= cursor.moveStartTime) {
        const progress = Math.min((now - cursor.moveStartTime) / cursor.moveDuration, 1);
        const ease = this.easeInOutCubic(progress);
        cursor.x += (cursor.targetX - cursor.x) * ease * 0.1;
        cursor.y += (cursor.targetY - cursor.y) * ease * 0.1;
        const dist = Math.hypot(cursor.targetX - cursor.x, cursor.targetY - cursor.y);
        if (dist < 2 || progress >= 1) {
          cursor.isMoving = false;
          cursor.transitionStartTime = now;
          cursor.finalMovePosition = { x: cursor.x, y: cursor.y };
          cursor.voteArea = { x: cursor.x, y: cursor.y };
        }
      } else if (!cursor.isMoving) {
        const tp = Math.min((now - cursor.transitionStartTime) / cursor.transitionDuration, 1);
        const time = now * 0.0005 * cursor.restingSpeed;
        const nx = cursor.voteArea.x + this.noise2D(cursor.noiseOffsetX, time) * cursor.restingRadius;
        const ny = cursor.voteArea.y + this.noise2D(cursor.noiseOffsetY, time) * cursor.restingRadius;
        if (tp < 1) {
          const ease = this.easeInOutCubic(tp);
          cursor.x = cursor.finalMovePosition.x + (nx - cursor.finalMovePosition.x) * ease;
          cursor.y = cursor.finalMovePosition.y + (ny - cursor.finalMovePosition.y) * ease;
        } else {
          cursor.x = nx;
          cursor.y = ny;
        }
        cursor.x = Math.max(0, Math.min(100, cursor.x));
        cursor.y = Math.max(0, Math.min(100, cursor.y));
      }
      this.broadcast(JSON.stringify({
        type: 'move',
        position: { x: Math.max(0, Math.min(100, cursor.x)), y: Math.max(0, Math.min(100, cursor.y)), timestamp: now, userId: cursor.id },
      }));
    });
  }

  private checkForStatementChanges() {
    if (!this._enabled) return;
    const currentId = getCurrentActiveStatementId(this.getStatements(), Date.now());
    if (currentId !== this.lastActiveStatementId) {
      console.log(`Statement changed from ${this.lastActiveStatementId} to ${currentId}, moving ghost cursors`);
      this.lastActiveStatementId = currentId;
      this.moveToNewTargets();
    }
  }

  private moveToNewTargets() {
    if (!this._enabled) return;
    const now = Date.now();
    const statements = this.getStatements();
    const next = statements.filter(s => s.displayTimestamp > now).sort((a, b) => a.displayTimestamp - b.displayTimestamp)[0];
    const timeUntilNext = next ? next.displayTimestamp - now : 10000;
    this.cursors.forEach(cursor => {
      const target = VOTE_AREAS[Math.floor(Math.random() * VOTE_AREAS.length)];
      cursor.targetX = target.x;
      cursor.targetY = target.y;
      cursor.isMoving = true;
      const startDelay = Math.random() * timeUntilNext * 0.2;
      cursor.moveStartTime = now + startDelay;
      cursor.moveDuration = Math.max(1000, timeUntilNext - startDelay - Math.random() * timeUntilNext * 0.2);
    });
  }

  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
}
