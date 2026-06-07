import type { ServerPlugin, PluginConnection, PluginContext } from '../types';
import type { SocialConfig } from '../../app/types';
import type { SocialSharingPluginState } from './types';

export const SocialSharingServerPlugin: ServerPlugin<SocialSharingPluginState> = {
  createState(): SocialSharingPluginState {
    return { config: null };
  },

  getPersistedState(state: SocialSharingPluginState): unknown {
    return { config: state.config };
  },

  applyPersistedState(state: SocialSharingPluginState, saved: unknown): void {
    const s = saved as SocialSharingPluginState | null;
    if (s?.config !== undefined) state.config = s.config;
  },

  onConnect(conn: PluginConnection, _ctx: PluginContext, state: SocialSharingPluginState): void {
    conn.send(JSON.stringify({ type: 'socialConfigChanged', config: state.config }));
  },

  onMessage(type: string, payload: unknown, _conn: PluginConnection, ctx: PluginContext, state: SocialSharingPluginState): boolean {
    if (type !== 'setSocialConfig') return false;
    const event = payload as { config: SocialConfig | null };
    state.config = event.config;
    ctx.broadcast(JSON.stringify({ type: 'socialConfigChanged', config: state.config }));
    void ctx.persistState();
    return true;
  },

  onActivate(): void {},
  onDeactivate(): void {},
};
