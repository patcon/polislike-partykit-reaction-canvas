import type { ServerPlugin, PluginConnection, PluginContext } from '../types';
import type { ArrivalCanvasPluginState } from './types';

export const ArrivalCanvasServerPlugin: ServerPlugin<ArrivalCanvasPluginState> = {
  createState(): ArrivalCanvasPluginState {
    return { capacity: 50 };
  },

  getPersistedState(state: ArrivalCanvasPluginState): unknown {
    return { capacity: state.capacity };
  },

  applyPersistedState(state: ArrivalCanvasPluginState, saved: unknown): void {
    const s = saved as ArrivalCanvasPluginState | null;
    if (typeof s?.capacity === 'number') state.capacity = s.capacity;
  },

  onConnect(conn: PluginConnection, _ctx: PluginContext, state: ArrivalCanvasPluginState): void {
    conn.send(JSON.stringify({ type: 'arrivalCapacityChanged', capacity: state.capacity }));
  },

  onMessage(type: string, payload: unknown, _conn: PluginConnection, ctx: PluginContext, state: ArrivalCanvasPluginState): boolean {
    if (type !== 'setArrivalCapacity') return false;
    const event = payload as { capacity: number };
    state.capacity = event.capacity;
    ctx.broadcast(JSON.stringify({ type: 'arrivalCapacityChanged', capacity: state.capacity }));
    void ctx.persistState();
    return true;
  },

  onActivate(): void {},
  onDeactivate(): void {},
};
