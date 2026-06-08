import type { ServerPlugin, PluginConnection, PluginContext } from '../types';

export interface LightState {
  color: string;
  brightness: number;
}

export const lightServer: ServerPlugin<LightState> = {
  createState: () => ({ color: '#000000', brightness: 100 }),

  onConnect(conn: PluginConnection, _ctx: PluginContext, state: LightState) {
    conn.send(JSON.stringify({ type: 'screenLightState', color: state.color, brightness: state.brightness }));
  },

  onMessage(type: string, payload: unknown, _conn: PluginConnection, ctx: PluginContext, state: LightState): boolean {
    if (type !== 'setLightColor') return false;
    const { color, brightness } = payload as { color: string; brightness: number };
    state.color = color;
    state.brightness = brightness;
    ctx.broadcast(JSON.stringify({ type: 'lightColor', color, brightness }));
    return true;
  },

  onActivate() {},
  onDeactivate() {},

  getPersistedState: (state: LightState) => ({ color: state.color, brightness: state.brightness }),

  applyPersistedState(state: LightState, saved: unknown) {
    const s = saved as Partial<LightState>;
    if (s?.color) state.color = s.color;
    if (s?.brightness !== undefined) state.brightness = s.brightness;
  },
};
