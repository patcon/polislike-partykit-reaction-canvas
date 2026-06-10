import type { ServerPlugin, PluginConnection, PluginContext } from '../types';

/** All participants display the same color/brightness. */
type GlobalLight = { mode: 'global'; color: string; brightness: number };

/** Each participant displays their own color/brightness, keyed by userId. */
type PerParticipantLight = { mode: 'perParticipant'; colors: Record<string, { color: string; brightness: number }> };

export interface LightState {
  /** Last received setBatchScreenLight payload — replayed to new connections so they join in the current state. */
  current: GlobalLight | PerParticipantLight;
}

export const lightServer: ServerPlugin<LightState> = {
  createState: () => ({ current: { mode: 'global', color: '#000000', brightness: 100 } }),

  /** Sends the current light state to a newly connected client so it doesn't flash black on join. */
  onConnect(conn: PluginConnection, _ctx: PluginContext, state: LightState) {
    conn.send(JSON.stringify({ type: 'setBatchScreenLight', ...state.current }));
  },

  /**
   * Accepts a `setBatchScreenLight` from the emcee/controller, stores it as the current state,
   * and broadcasts it to all participants (including ScreenLight panels).
   * The server is stateless beyond the last tick — no history is kept.
   */
  onMessage(type: string, payload: unknown, _conn: PluginConnection, ctx: PluginContext, state: LightState): boolean {
    if (type !== 'setBatchScreenLight') return false;
    const p = payload as GlobalLight | PerParticipantLight;
    state.current = p;
    ctx.broadcast(JSON.stringify({ type: 'setBatchScreenLight', ...p }));
    return true;
  },

  onActivate() {},
  onDeactivate() {},
};
