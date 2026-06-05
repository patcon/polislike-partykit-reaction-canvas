const BALL_R = 2;
const DAMPING = 0.7;
const FRICTION = 0.991;
const GOAL_MIN_Y = 33;
const GOAL_MAX_Y = 67;
const KICK_RADIUS = 8;
const KICK_FORCE = 2.5;
const TICK_MS = 50;

export interface BallState {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface SoccerScore {
  left: number;
  right: number;
}

export class SoccerPhysicsEngine {
  private _ball: BallState = { x: 50, y: 50, vx: 2, vy: 1 };
  private _score: SoccerScore = { left: 0, right: 0 };
  private interval?: NodeJS.Timeout;

  constructor(
    private broadcast: (msg: string) => void,
    private getCursorPositions: () => Map<string, { x: number; y: number }>,
  ) {}

  get ballState(): BallState { return this._ball; }
  get score(): SoccerScore { return this._score; }

  start() {
    if (this.interval) clearInterval(this.interval);
    this.resetBall();
    this.interval = setInterval(() => this.tick(), TICK_MS);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
    this.broadcast(JSON.stringify({ type: 'ballHidden' }));
  }

  resetScore() {
    this._score = { left: 0, right: 0 };
    this.broadcast(JSON.stringify({ type: 'goalScored', score: this._score }));
  }

  private resetBall() {
    const dir = Math.random() > 0.5 ? 1 : -1;
    this._ball = { x: 50, y: 50, vx: dir * (1.5 + Math.random()), vy: (Math.random() - 0.5) * 2 };
  }

  private tick() {
    const b = this._ball;

    b.vx *= FRICTION;
    b.vy *= FRICTION;

    for (const [, pos] of this.getCursorPositions()) {
      const dx = b.x - pos.x;
      const dy = b.y - pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < KICK_RADIUS && dist > 0.1) {
        const force = KICK_FORCE * (1 - dist / KICK_RADIUS);
        b.vx += (dx / dist) * force;
        b.vy += (dy / dist) * force;
      }
    }

    b.x += b.vx;
    b.y += b.vy;

    if (b.y - BALL_R < 0)   { b.y = BALL_R;         b.vy =  Math.abs(b.vy) * DAMPING; }
    if (b.y + BALL_R > 100) { b.y = 100 - BALL_R;   b.vy = -Math.abs(b.vy) * DAMPING; }

    if (b.x - BALL_R <= 0) {
      if (b.y >= GOAL_MIN_Y && b.y <= GOAL_MAX_Y) {
        this._score.right++;
        this.broadcast(JSON.stringify({ type: 'goalScored', scorer: 'right', score: this._score }));
        this.resetBall();
        return;
      }
      b.x = BALL_R;
      b.vx = Math.abs(b.vx) * DAMPING;
    }

    if (b.x + BALL_R >= 100) {
      if (b.y >= GOAL_MIN_Y && b.y <= GOAL_MAX_Y) {
        this._score.left++;
        this.broadcast(JSON.stringify({ type: 'goalScored', scorer: 'left', score: this._score }));
        this.resetBall();
        return;
      }
      b.x = 100 - BALL_R;
      b.vx = -Math.abs(b.vx) * DAMPING;
    }

    this.broadcast(JSON.stringify({ type: 'ballUpdate', x: b.x, y: b.y }));
  }
}
