/**
 * Plugin dispatch contract tests.
 *
 * These tests verify the server's responsibilities toward plugins:
 *   - lifecycle methods are called with the correct userId (not conn.id)
 *   - onMessage routing: plugins get first dibs; returning true stops processing
 *   - ctx.sendToUser delivers to the right connection
 *
 * They use a minimal spy plugin injected via vi.mock so no real panel
 * behaviour is involved. If these break, the server's plugin plumbing is
 * broken — not a panel-specific bug.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ServerPlugin } from '../../plugins/types';
import type { PanelPlugin } from '../../plugins/types';

// vi.mock factories are hoisted before imports, so we use vi.hoisted to create
// values that are available both inside the factory and in the test body.
const { spyServer, spyPlugin } = vi.hoisted(() => {
  const spyServer = {
    createState: () => ({}),
    onConnect:    vi.fn(),
    onMessage:    vi.fn().mockReturnValue(false),
    onActivate:   vi.fn(),
    onDeactivate: vi.fn(),
    onClose:      vi.fn(),
  } satisfies ServerPlugin<object>;

  const spyPlugin = {
    id: 'spy',
    label: 'Spy',
    description: '',
    canStandalone: false,
    canScreenMount: false,
    server: spyServer,
  } satisfies PanelPlugin;

  return { spyServer, spyPlugin };
});

vi.mock('../../plugins/index', () => ({
  PLUGINS:    [spyPlugin],
  PLUGIN_MAP: { spy: spyPlugin },
}));

// The server imports getSoccerScore/getSoccerBallState directly (outside the
// plugin registry) and calls them unconditionally in onConnect. Stub them out
// so this file doesn't depend on the soccer plugin's internal state shape.
vi.mock('../../plugins/soccer/server', () => ({
  getSoccerBallState: () => null,
  getSoccerScore:     () => ({ left: 0, right: 0 }),
}));

// Disable cursor batching so dispatch tests get immediate broadcasts
// without needing fake timers. Batching behaviour is tested in server.test.ts.
vi.mock('../../app/utils/cursor', () => ({ SERVER_CURSOR_BATCH_MS: 0 }));

import Server from '../server';
import { createMockRoom, createMockConnection, makeConnectCtx } from './helpers/mockParty';

function msg(event: object) { return JSON.stringify(event); }

describe('server plugin dispatch contracts', () => {
  let connections: ReturnType<typeof createMockConnection>['conn'][];
  let room: ReturnType<typeof createMockRoom>['room'];
  let server: Server;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    connections = [];
    ({ room } = createMockRoom(connections));
    server = new Server(room);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function connectUser(userId: string) {
    const { conn, send } = createMockConnection(`conn-${userId}`);
    connections.push(conn);
    server.onConnect(conn, makeConnectCtx(userId));
    return { conn, send };
  }

  // ── userId contracts ──────────────────────────────────────────────────────

  describe('onConnect — userId', () => {
    it('passes the persistent userId, not the connection id', () => {
      const { conn } = connectUser('alice');
      const [pluginConn] = spyServer.onConnect.mock.calls[0];
      expect(pluginConn.userId).toBe('alice');
      expect(pluginConn.userId).not.toBe(conn.id);
    });
  });

  describe('onClose — userId', () => {
    it('passes the persistent userId, not the connection id', () => {
      const { conn } = connectUser('alice');
      vi.clearAllMocks();
      server.onClose(conn);
      const [pluginConn] = spyServer.onClose.mock.calls[0];
      expect(pluginConn.userId).toBe('alice');
      expect(pluginConn.userId).not.toBe(conn.id);
    });
  });

  // ── onMessage routing ─────────────────────────────────────────────────────

  describe('onMessage routing', () => {
    it('calls plugin onMessage before the main switch', () => {
      const { conn } = connectUser('alice');
      vi.clearAllMocks();
      server.onMessage(msg({ type: 'move', position: { userId: 'alice', x: 0.5, y: 0.5, timestamp: 1 } }), conn);
      expect(spyServer.onMessage).toHaveBeenCalledOnce();
      const [type] = spyServer.onMessage.mock.calls[0];
      expect(type).toBe('move');
    });

    it('stops processing when plugin returns true', () => {
      const { conn } = connectUser('alice');
      const { broadcast } = createMockRoom(connections);
      vi.spyOn(room, 'broadcast').mockImplementation(broadcast);
      spyServer.onMessage.mockReturnValue(true);

      // 'move' normally broadcasts to other clients — if the plugin intercepts
      // it, the broadcast should NOT happen.
      broadcast.mockClear();
      server.onMessage(msg({ type: 'move', position: { userId: 'alice', x: 0.5, y: 0.5, timestamp: 1 } }), conn);
      expect(broadcast).not.toHaveBeenCalled();
    });

    it('continues to main switch when plugin returns false', () => {
      const { conn } = connectUser('alice');
      const broadcastSpy = vi.spyOn(room, 'broadcast');
      spyServer.onMessage.mockReturnValue(false);
      broadcastSpy.mockClear();

      server.onMessage(msg({ type: 'move', position: { userId: 'alice', x: 0.5, y: 0.5, timestamp: 1 } }), conn);
      expect(broadcastSpy).toHaveBeenCalled();
    });
  });

  // ── ctx.sendToUser ────────────────────────────────────────────────────────

  describe('ctx.sendToUser', () => {
    it('delivers to all connections for the target userId, not the sender', () => {
      const { conn: aliceConn, send: aliceSend } = connectUser('alice');
      const { send: bobSend } = connectUser('bob');

      // Intercept onMessage to grab ctx and exercise sendToUser
      spyServer.onMessage.mockImplementationOnce((_type, _payload, _conn, ctx) => {
        ctx.sendToUser('bob', JSON.stringify({ type: 'test-delivery' }));
        return true;
      });

      server.onMessage(msg({ type: 'anything' }), aliceConn);

      const bobMsgs = bobSend.mock.calls.map(([m]) => JSON.parse(m));
      expect(bobMsgs).toContainEqual({ type: 'test-delivery' });
      // Alice should not have received it
      const aliceMsgs = aliceSend.mock.calls.map(([m]) => JSON.parse(m));
      expect(aliceMsgs).not.toContainEqual({ type: 'test-delivery' });
    });
  });
});
