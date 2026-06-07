import type { ServerPlugin, PluginConnection, PluginContext } from '../types';

export const signatureServer: ServerPlugin<Record<string, never>> = {
  createState: () => ({}),
  onConnect() {},
  onActivate(_ctx: PluginContext, _state: Record<string, never>) {},
  onDeactivate(_ctx: PluginContext, _state: Record<string, never>) {},

  onMessage(type: string, payload: unknown, _conn: PluginConnection, ctx: PluginContext, _state: Record<string, never>, _currentActivity: string): boolean {
    if (type === 'strokeSegment') {
      ctx.broadcast(JSON.stringify({ type: 'strokeSegment', ...(payload as object) }));
      return true;
    }
    if (type === 'clearSignature') {
      const { userId } = payload as { userId: string };
      ctx.broadcast(JSON.stringify({ type: 'signatureCleared', userId }));
      return true;
    }
    return false;
  },
};
