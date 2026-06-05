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

// Message type constants — shared between client and server to avoid magic strings.
export const SOCCER_BALL_UPDATE = 'ballUpdate' as const;
export const SOCCER_BALL_HIDDEN = 'ballHidden' as const;
export const SOCCER_GOAL_SCORED = 'goalScored' as const;
export const SOCCER_RESET_SCORE = 'resetSoccerScore' as const;
export const SOCCER_BALL_STATE = 'ballState' as const;
