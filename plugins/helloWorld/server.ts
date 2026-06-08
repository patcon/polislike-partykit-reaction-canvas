import type { ServerPlugin, PluginConnection, PluginContext } from '../types';
import type { HelloWorldPluginState } from './types';

export const HelloWorldServerPlugin: ServerPlugin<HelloWorldPluginState> = {
  createState(): HelloWorldPluginState {
    return { message: 'Hello, world!' };
  },

  onConnect(conn: PluginConnection, _ctx: PluginContext, state: HelloWorldPluginState): void {
    conn.send(JSON.stringify({ type: 'helloWorldState', message: state.message }));
  },

  onMessage(type, payload, _conn, ctx, state): boolean {
    if (type !== 'setHelloWorldMessage') return false;
    state.message = (payload as { message: string }).message;
    ctx.broadcast(JSON.stringify({ type: 'helloWorldState', message: state.message }));
    void ctx.persistState();
    return true;
  },

  onActivate(): void {},
  onDeactivate(): void {},

  getPersistedState(state): unknown { return { message: state.message }; },

  applyPersistedState(state, saved): void {
    const s = saved as HelloWorldPluginState | null;
    if (s?.message) state.message = s.message;
  },
};
