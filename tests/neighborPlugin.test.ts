import { describe, it, expect, vi } from 'vitest';
import { NeighborServerPlugin } from '../plugins/neighbor/server';
import type { PluginConnection, PluginContext } from '../plugins/types';
import type { NeighborState } from '../plugins/neighbor/types';

function makeCtx(): PluginContext {
  return {
    broadcast: vi.fn(),
    getCursorPositions: () => new Map(),
    persistState: vi.fn().mockResolvedValue(undefined),
  };
}

function makeConn(id = 'conn-1', userId = 'user-1'): PluginConnection {
  return { id, userId, send: vi.fn() };
}

function sent(conn: PluginConnection): unknown[] {
  return (conn.send as ReturnType<typeof vi.fn>).mock.calls.map((c) => JSON.parse(c[0]));
}

describe('NeighborServerPlugin', () => {
  describe('createState', () => {
    it('initializes with empty maps and set', () => {
      const state = NeighborServerPlugin.createState();
      expect(state.codes.size).toBe(0);
      expect(state.edges.size).toBe(0);
      expect(state.connUsers.size).toBe(0);
    });
  });

  describe('onConnect', () => {
    it('assigns a code and sends neighborCode message', () => {
      const state = NeighborServerPlugin.createState();
      const conn = makeConn('conn-1', 'alice');
      NeighborServerPlugin.onConnect(conn, makeCtx(), state, 'neighbor');

      expect(state.codes.has('alice')).toBe(true);
      const msgs = sent(conn);
      expect(msgs).toContainEqual({ type: 'neighborCode', code: state.codes.get('alice') });
    });

    it('reuses existing code on second connection for same userId', () => {
      const state = NeighborServerPlugin.createState();
      const conn1 = makeConn('conn-1', 'alice');
      const conn2 = makeConn('conn-2', 'alice');
      NeighborServerPlugin.onConnect(conn1, makeCtx(), state, 'neighbor');
      const firstCode = state.codes.get('alice');
      NeighborServerPlugin.onConnect(conn2, makeCtx(), state, 'neighbor');
      expect(state.codes.get('alice')).toBe(firstCode);
    });

    it('generates unique codes for different users', () => {
      const state = NeighborServerPlugin.createState();
      NeighborServerPlugin.onConnect(makeConn('c1', 'alice'), makeCtx(), state, 'neighbor');
      NeighborServerPlugin.onConnect(makeConn('c2', 'bob'), makeCtx(), state, 'neighbor');
      expect(state.codes.get('alice')).not.toBe(state.codes.get('bob'));
    });

    it('tracks connection in connUsers', () => {
      const state = NeighborServerPlugin.createState();
      const conn = makeConn('conn-1', 'alice');
      NeighborServerPlugin.onConnect(conn, makeCtx(), state, 'neighbor');
      expect(state.connUsers.get('conn-1')).toBe('alice');
    });
  });

  describe('onClose', () => {
    it('deletes code when last connection for that user closes', () => {
      const state = NeighborServerPlugin.createState();
      const conn = makeConn('conn-1', 'alice');
      NeighborServerPlugin.onConnect(conn, makeCtx(), state, 'neighbor');
      expect(state.codes.has('alice')).toBe(true);

      NeighborServerPlugin.onClose!(conn, makeCtx(), state);
      expect(state.codes.has('alice')).toBe(false);
    });

    it('keeps code if user still has another connection open', () => {
      const state = NeighborServerPlugin.createState();
      const conn1 = makeConn('conn-1', 'alice');
      const conn2 = makeConn('conn-2', 'alice');
      NeighborServerPlugin.onConnect(conn1, makeCtx(), state, 'neighbor');
      NeighborServerPlugin.onConnect(conn2, makeCtx(), state, 'neighbor');

      NeighborServerPlugin.onClose!(conn1, makeCtx(), state);
      expect(state.codes.has('alice')).toBe(true);
    });

    it('removes connection from connUsers', () => {
      const state = NeighborServerPlugin.createState();
      const conn = makeConn('conn-1', 'alice');
      NeighborServerPlugin.onConnect(conn, makeCtx(), state, 'neighbor');
      NeighborServerPlugin.onClose!(conn, makeCtx(), state);
      expect(state.connUsers.has('conn-1')).toBe(false);
    });
  });

  describe('onMessage – neighborEdge', () => {
    function setup(): { state: NeighborState; ctx: PluginContext; aliceConn: PluginConnection; bobCode: string } {
      const state = NeighborServerPlugin.createState();
      const ctx = makeCtx();
      const aliceConn = makeConn('c-alice', 'alice');
      const bobConn = makeConn('c-bob', 'bob');
      NeighborServerPlugin.onConnect(aliceConn, ctx, state, 'neighbor');
      NeighborServerPlugin.onConnect(bobConn, ctx, state, 'neighbor');
      const bobCode = state.codes.get('bob')!;
      return { state, ctx, aliceConn, bobCode };
    }

    it('returns true (handled) for neighborEdge messages', () => {
      const { state, ctx, aliceConn, bobCode } = setup();
      const handled = NeighborServerPlugin.onMessage('neighborEdge', { toCode: bobCode }, aliceConn, ctx, state, 'neighbor');
      expect(handled).toBe(true);
    });

    it('valid edge: adds to state and broadcasts neighborEdgeAdded', () => {
      const { state, ctx, aliceConn, bobCode } = setup();
      NeighborServerPlugin.onMessage('neighborEdge', { toCode: bobCode }, aliceConn, ctx, state, 'neighbor');
      expect(state.edges.size).toBe(1);
      const broadcast = ctx.broadcast as ReturnType<typeof vi.fn>;
      const msg = JSON.parse(broadcast.mock.calls[broadcast.mock.calls.length - 1][0]);
      expect(msg.type).toBe('neighborEdgeAdded');
      expect([msg.userA, msg.userB].sort()).toEqual(['alice', 'bob']);
    });

    it('self-connection: sends neighborEdgeError with reason self', () => {
      const state = NeighborServerPlugin.createState();
      const ctx = makeCtx();
      const conn = makeConn('c-alice', 'alice');
      NeighborServerPlugin.onConnect(conn, ctx, state, 'neighbor');
      const aliceCode = state.codes.get('alice')!;
      NeighborServerPlugin.onMessage('neighborEdge', { toCode: aliceCode }, conn, ctx, state, 'neighbor');
      expect(sent(conn)).toContainEqual({ type: 'neighborEdgeError', reason: 'self' });
    });

    it('code not found: sends neighborEdgeError with reason not_found', () => {
      const state = NeighborServerPlugin.createState();
      const ctx = makeCtx();
      const conn = makeConn('c-alice', 'alice');
      NeighborServerPlugin.onConnect(conn, ctx, state, 'neighbor');
      NeighborServerPlugin.onMessage('neighborEdge', { toCode: '9999' }, conn, ctx, state, 'neighbor');
      expect(sent(conn)).toContainEqual({ type: 'neighborEdgeError', reason: 'not_found' });
    });

    it('duplicate edge: sends neighborEdgeError with reason duplicate', () => {
      const { state, ctx, aliceConn, bobCode } = setup();
      NeighborServerPlugin.onMessage('neighborEdge', { toCode: bobCode }, aliceConn, ctx, state, 'neighbor');
      (aliceConn.send as ReturnType<typeof vi.fn>).mockClear();
      NeighborServerPlugin.onMessage('neighborEdge', { toCode: bobCode }, aliceConn, ctx, state, 'neighbor');
      expect(sent(aliceConn)).toContainEqual({ type: 'neighborEdgeError', reason: 'duplicate' });
    });
  });

  describe('onMessage – requestNeighborEdges', () => {
    it('returns true (handled) and sends neighborEdgesSnapshot to requester', () => {
      const state = NeighborServerPlugin.createState();
      const ctx = makeCtx();
      const conn = makeConn('c-alice', 'alice');
      NeighborServerPlugin.onConnect(conn, ctx, state, 'neighbor');

      const handled = NeighborServerPlugin.onMessage('requestNeighborEdges', {}, conn, ctx, state, 'neighbor');
      expect(handled).toBe(true);
      const msgs = sent(conn);
      const snapshot = msgs.find((m: any) => (m as any).type === 'neighborEdgesSnapshot') as any;
      expect(snapshot).toBeDefined();
      expect(snapshot.edges).toEqual([]);
      expect(snapshot.allCodes['alice']).toBe(state.codes.get('alice'));
    });

    it('includes existing edges in snapshot', () => {
      const state = NeighborServerPlugin.createState();
      const ctx = makeCtx();
      const aliceConn = makeConn('c-alice', 'alice');
      const bobConn = makeConn('c-bob', 'bob');
      NeighborServerPlugin.onConnect(aliceConn, ctx, state, 'neighbor');
      NeighborServerPlugin.onConnect(bobConn, ctx, state, 'neighbor');
      const bobCode = state.codes.get('bob')!;
      NeighborServerPlugin.onMessage('neighborEdge', { toCode: bobCode }, aliceConn, ctx, state, 'neighbor');

      (bobConn.send as ReturnType<typeof vi.fn>).mockClear();
      NeighborServerPlugin.onMessage('requestNeighborEdges', {}, bobConn, ctx, state, 'neighbor');
      const msgs = sent(bobConn);
      const snapshot = msgs.find((m: any) => (m as any).type === 'neighborEdgesSnapshot') as any;
      expect(snapshot.edges).toHaveLength(1);
    });
  });

  describe('onMessage – clearNeighborEdges', () => {
    it('returns true (handled), clears all edges, and broadcasts neighborEdgesCleared', () => {
      const state = NeighborServerPlugin.createState();
      const ctx = makeCtx();
      const aliceConn = makeConn('c-alice', 'alice');
      const bobConn = makeConn('c-bob', 'bob');
      NeighborServerPlugin.onConnect(aliceConn, ctx, state, 'neighbor');
      NeighborServerPlugin.onConnect(bobConn, ctx, state, 'neighbor');
      const bobCode = state.codes.get('bob')!;
      NeighborServerPlugin.onMessage('neighborEdge', { toCode: bobCode }, aliceConn, ctx, state, 'neighbor');
      expect(state.edges.size).toBe(1);

      (ctx.broadcast as ReturnType<typeof vi.fn>).mockClear();
      const handled = NeighborServerPlugin.onMessage('clearNeighborEdges', {}, aliceConn, ctx, state, 'neighbor');
      expect(handled).toBe(true);
      expect(state.edges.size).toBe(0);
      const broadcastMsg = JSON.parse((ctx.broadcast as ReturnType<typeof vi.fn>).mock.calls[0][0]);
      expect(broadcastMsg).toEqual({ type: 'neighborEdgesCleared' });
    });
  });

  describe('onMessage – unhandled', () => {
    it('returns false for unrecognized message types', () => {
      const state = NeighborServerPlugin.createState();
      const conn = makeConn();
      const handled = NeighborServerPlugin.onMessage('someOtherEvent', {}, conn, makeCtx(), state, 'neighbor');
      expect(handled).toBe(false);
    });
  });
});
