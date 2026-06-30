import type { ServerPlugin, PluginConnection, PluginContext } from '../types';
import type { BallState, SoccerScore } from './types';
import { SOCCER_RESET_SCORE } from './types';
import { SoccerPhysicsEngine } from './physics';

type SoccerState = {
  engine: SoccerPhysicsEngine;
  /** Mutable ref updated by onActivate/onDeactivate so engine closures always use the live ctx. */
  ctx: { current: PluginContext | null };
};

export const SoccerServerPlugin: ServerPlugin<SoccerState> = {
  createState(): SoccerState {
    const ctx = { current: null as PluginContext | null };
    const engine = new SoccerPhysicsEngine(
      (msg) => { ctx.current?.broadcast(msg); },
      () => ctx.current?.getCursorPositions() ?? new Map(),
    );
    return { engine, ctx };
  },

  onConnect(conn: PluginConnection, _ctx: PluginContext, state: SoccerState, currentScreenPanel: string): void {
    if (currentScreenPanel === 'soccer') {
      conn.send(JSON.stringify({ type: 'ballState', ...state.engine.ballState }));
    }
  },

  onMessage(type: string, _payload: unknown, _conn: PluginConnection, _ctx: PluginContext, state: SoccerState): boolean {
    if (type === SOCCER_RESET_SCORE) {
      state.engine.resetScore();
      return true;
    }
    return false;
  },

  onActivate(ctx: PluginContext, state: SoccerState): void {
    state.ctx.current = ctx;
    state.engine.start();
  },

  onDeactivate(_ctx: PluginContext, state: SoccerState): void {
    state.engine.stop();
    state.ctx.current = null;
  },
};

/** Typed accessors for the server to read soccer state into screenPanelChanged broadcasts. */
export function getSoccerBallState(state: unknown): BallState {
  return (state as SoccerState).engine.ballState;
}

export function getSoccerScore(state: unknown): SoccerScore {
  return (state as SoccerState).engine.score;
}
