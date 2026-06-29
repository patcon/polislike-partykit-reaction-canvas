import type { ServerPlugin, PluginConnection, PluginContext } from '../types';
import type { MapPluginState } from './types';

export const mapServer: ServerPlugin<MapPluginState> = {
  createState: () => ({ projection: null, viewerConfig: null }),

  onConnect(conn: PluginConnection, _ctx: PluginContext, state: MapPluginState) {
    conn.send(JSON.stringify({ type: 'mapProjectionChanged', projection: state.projection }));
    if (state.viewerConfig) {
      conn.send(JSON.stringify({ type: 'mapViewerConfigChanged', config: state.viewerConfig }));
    }
  },

  onMessage(type: string, payload: unknown, _conn: PluginConnection, ctx: PluginContext, state: MapPluginState): boolean {
    if (type === 'mapProjectionSet') {
      const { projection } = payload as { projection: MapPluginState['projection'] };
      state.projection = projection;
      void ctx.persistState();
      ctx.broadcast(JSON.stringify({ type: 'mapProjectionChanged', projection }));
      return true;
    }
    if (type === 'mapProjectionClear') {
      state.projection = null;
      void ctx.persistState();
      ctx.broadcast(JSON.stringify({ type: 'mapProjectionChanged', projection: null }));
      return true;
    }
    if (type === 'mapViewerConfigSet') {
      const { config } = payload as { config: MapPluginState['viewerConfig'] };
      state.viewerConfig = config;
      void ctx.persistState();
      ctx.broadcast(JSON.stringify({ type: 'mapViewerConfigChanged', config }));
      return true;
    }
    return false;
  },

  onActivate() {},
  onDeactivate() {},

  getPersistedState: (state: MapPluginState) => ({ projection: state.projection, viewerConfig: state.viewerConfig }),

  applyPersistedState(state: MapPluginState, saved: unknown) {
    const s = saved as Partial<MapPluginState>;
    if (s?.projection !== undefined) state.projection = s.projection ?? null;
    if (s?.viewerConfig !== undefined) state.viewerConfig = s.viewerConfig ?? null;
  },
};
