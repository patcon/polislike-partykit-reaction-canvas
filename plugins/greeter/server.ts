import type { ServerPlugin, PluginConnection, PluginContext } from '../types';
import type { GreeterPluginState } from './types';

export const GreeterServerPlugin: ServerPlugin<GreeterPluginState> = {
  createState(): GreeterPluginState {
    return { config: null };
  },

  getPersistedState(state: GreeterPluginState): unknown {
    return { config: state.config };
  },

  applyPersistedState(state: GreeterPluginState, saved: unknown): void {
    const s = saved as GreeterPluginState | null;
    if (s?.config !== undefined) state.config = s.config;
  },

  onConnect(conn: PluginConnection, _ctx: PluginContext, state: GreeterPluginState): void {
    conn.send(JSON.stringify({ type: 'greeterConfigChanged', config: state.config }));
  },

  onMessage(type: string, payload: unknown, _conn: PluginConnection, ctx: PluginContext, state: GreeterPluginState): boolean {
    if (type !== 'setGreeterConfig') return false;
    const event = payload as { config: { eventUrl: string } | null };
    state.config = event.config;
    ctx.broadcast(JSON.stringify({ type: 'greeterConfigChanged', config: state.config }));
    void ctx.persistState();
    return true;
  },

  onActivate(): void {},
  onDeactivate(): void {},
};
