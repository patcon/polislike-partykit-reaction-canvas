import type { ServerPlugin, PluginConnection, PluginContext } from '../types';
import type { NeighborState } from './types';

function generateNeighborCode(codes: Map<string, string>): string {
  const used = new Set(codes.values());
  let code: string;
  do {
    code = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  } while (used.has(code));
  return code;
}

export const NeighborServerPlugin: ServerPlugin<NeighborState> = {
  createState: () => ({ codes: new Map(), edges: new Set(), connUsers: new Map() }),

  onConnect(conn: PluginConnection, _ctx: PluginContext, state: NeighborState) {
    state.connUsers.set(conn.id, conn.userId);
    if (!state.codes.has(conn.userId)) {
      state.codes.set(conn.userId, generateNeighborCode(state.codes));
    }
    conn.send(JSON.stringify({ type: 'neighborCode', code: state.codes.get(conn.userId) }));
  },

  onClose(conn: PluginConnection, _ctx: PluginContext, state: NeighborState) {
    state.connUsers.delete(conn.id);
    const stillConnected = [...state.connUsers.values()].some(uid => uid === conn.userId);
    if (!stillConnected) state.codes.delete(conn.userId);
  },

  onMessage(type: string, payload: unknown, conn: PluginConnection, ctx: PluginContext, state: NeighborState): boolean {
    if (type === 'neighborEdge') {
      const { toCode } = payload as { toCode: string };
      if (state.codes.get(conn.userId) === toCode) {
        conn.send(JSON.stringify({ type: 'neighborEdgeError', reason: 'self' }));
        return true;
      }
      let toUserId: string | null = null;
      for (const [uid, code] of state.codes) {
        if (code === toCode) { toUserId = uid; break; }
      }
      if (!toUserId) {
        conn.send(JSON.stringify({ type: 'neighborEdgeError', reason: 'not_found' }));
        return true;
      }
      const canonical = [conn.userId, toUserId].sort().join('|');
      if (state.edges.has(canonical)) {
        conn.send(JSON.stringify({ type: 'neighborEdgeError', reason: 'duplicate' }));
        return true;
      }
      state.edges.add(canonical);
      const [userA, userB] = canonical.split('|');
      ctx.broadcast(JSON.stringify({ type: 'neighborEdgeAdded', userA, userB }));
      return true;
    }

    if (type === 'getNeighborCode') {
      conn.send(JSON.stringify({ type: 'neighborCode', code: state.codes.get(conn.userId) }));
      return true;
    }

    if (type === 'requestNeighborEdges') {
      const edges = [...state.edges].map(e => { const [userA, userB] = e.split('|'); return { userA, userB }; });
      const allCodes = Object.fromEntries(state.codes);
      conn.send(JSON.stringify({ type: 'neighborEdgesSnapshot', edges, allCodes }));
      return true;
    }

    if (type === 'clearNeighborEdges') {
      state.edges.clear();
      ctx.broadcast(JSON.stringify({ type: 'neighborEdgesCleared' }));
      return true;
    }

    return false;
  },

  onActivate() {},
  onDeactivate() {},
};
