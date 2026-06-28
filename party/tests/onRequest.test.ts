/**
 * HTTP surface tests for the PartyKit server: the `onRequest` REST endpoints
 * (vote submission/retrieval, github submissions, debug-state) and the Polis
 * API proxy reached through the `updateStatementsPool` client message.
 *
 * Plugins are mocked out to an empty registry so these tests exercise only the
 * server's own request handling, not plugin `onRequest` delegation (which is a
 * separate contract).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type * as Party from 'partykit/server';
import Server from '../server';
import { createMockRoom, createMockConnection } from './helpers/mockParty';

vi.mock('../../plugins/index', () => ({ PLUGINS: [], PLUGIN_MAP: {} }));
// Immediate broadcasts (no cursor batching) keep async assertions simple.
vi.mock('../../app/utils/cursor', () => ({ SERVER_CURSOR_BATCH_MS: 0 }));

function makeRequest(
  method: string,
  path: string,
  opts: { json?: unknown } = {},
): Party.Request {
  return {
    method,
    url: `https://test.example.com${path}`,
    json: async () => {
      if ('json' in opts) return opts.json;
      throw new SyntaxError('Unexpected end of JSON input');
    },
  } as unknown as Party.Request;
}

describe('Server.onRequest', () => {
  let room: Party.Room;
  let server: Server;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    ({ room } = createMockRoom([]));
    server = new Server(room);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── POST /vote ────────────────────────────────────────────────────────────

  describe('POST /vote', () => {
    const validVote = { userId: 'u1', statementId: 3, vote: 1, timestamp: 123 };

    it('stores a valid vote and returns the running count', async () => {
      const res = await server.onRequest(makeRequest('POST', '/parties/main/room/vote', { json: validVote }));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true, voteCount: 1 });
    });

    it('defaults a missing timestamp instead of rejecting', async () => {
      const { userId, statementId, vote } = validVote;
      const res = await server.onRequest(makeRequest('POST', '/vote', { json: { userId, statementId, vote } }));
      expect(res.status).toBe(200);
      // The stored vote should now be retrievable with a timestamp filled in.
      const votes = await (await server.onRequest(makeRequest('GET', '/votes'))).json();
      expect(votes[0].timestamp).toEqual(expect.any(Number));
    });

    it.each([
      ['missing userId', { statementId: 1, vote: 1 }],
      ['non-numeric statementId', { userId: 'u1', statementId: '1', vote: 1 }],
      ['out-of-range vote', { userId: 'u1', statementId: 1, vote: 2 }],
    ])('rejects invalid vote data (%s) with 400', async (_label, body) => {
      const res = await server.onRequest(makeRequest('POST', '/vote', { json: body }));
      expect(res.status).toBe(400);
    });

    it('returns 500 when the body is not valid JSON', async () => {
      const res = await server.onRequest(makeRequest('POST', '/vote')); // json() throws
      expect(res.status).toBe(500);
    });

    it.each([-1, 0, 1])('accepts the valid vote value %i', async (vote) => {
      const res = await server.onRequest(makeRequest('POST', '/vote', { json: { userId: 'u', statementId: 0, vote } }));
      expect(res.status).toBe(200);
    });
  });

  // ── GET / DELETE /votes ─────────────────────────────────────────────────────

  describe('GET /votes and DELETE /votes', () => {
    it('returns an empty array before any votes are cast', async () => {
      const res = await server.onRequest(makeRequest('GET', '/votes'));
      expect(await res.json()).toEqual([]);
    });

    it('returns stored votes, then clears them on DELETE', async () => {
      await server.onRequest(makeRequest('POST', '/vote', { json: { userId: 'a', statementId: 1, vote: 1 } }));
      await server.onRequest(makeRequest('POST', '/vote', { json: { userId: 'b', statementId: 2, vote: -1 } }));

      const before = await (await server.onRequest(makeRequest('GET', '/votes'))).json();
      expect(before).toHaveLength(2);

      const del = await server.onRequest(makeRequest('DELETE', '/votes'));
      expect(await del.json()).toEqual({ success: true, message: 'All votes cleared' });

      const after = await (await server.onRequest(makeRequest('GET', '/votes'))).json();
      expect(after).toEqual([]);
    });
  });

  // ── GET / DELETE /github-submissions ────────────────────────────────────────

  describe('github-submissions endpoints', () => {
    it('returns an empty list and clears on DELETE', async () => {
      const get = await server.onRequest(makeRequest('GET', '/github-submissions'));
      expect(await get.json()).toEqual([]);

      const del = await server.onRequest(makeRequest('DELETE', '/github-submissions'));
      expect(await del.json()).toEqual({ success: true });
    });
  });

  // ── debug-state ─────────────────────────────────────────────────────────────

  describe('debug-state endpoints', () => {
    it('GET reads persisted state from storage', async () => {
      const res = await server.onRequest(makeRequest('GET', '/debug-state'));
      const body = await res.json();
      expect(room.storage.get).toHaveBeenCalledWith('state');
      expect(body).toHaveProperty('inMemoryPluginStates');
    });

    it('DELETE removes persisted state from storage', async () => {
      const res = await server.onRequest(makeRequest('DELETE', '/debug-state'));
      expect(room.storage.delete).toHaveBeenCalledWith('state');
      expect(await res.json()).toEqual({ success: true, message: 'Persisted state deleted from storage' });
    });
  });

  // ── default response ────────────────────────────────────────────────────────

  describe('unmatched routes', () => {
    it('returns the default plain-text health response', async () => {
      const res = await server.onRequest(makeRequest('GET', '/something-else'));
      expect(res.headers.get('Content-Type')).toBe('text/plain');
      expect(await res.text()).toBe('Cursor tracking server is running');
    });
  });
});

// ── Polis API proxy (updateStatementsPool) ────────────────────────────────────

describe('Polis statements-pool proxy', () => {
  let room: Party.Room;
  let broadcast: ReturnType<typeof vi.fn>;
  let server: Server;
  let conn: Party.Connection;

  function lastBroadcast() {
    const calls = broadcast.mock.calls;
    return JSON.parse(calls[calls.length - 1][0] as string);
  }

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    ({ room, broadcast } = createMockRoom([]));
    server = new Server(room);
    ({ conn } = createMockConnection('conn-1'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('fetches from the Polis API and broadcasts the loaded pool', async () => {
    const statements = [{ txt: 'hi', tid: 1, created: '2024', is_seed: false, is_meta: false, lang: 'en', pid: 0 }];
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => statements });
    vi.stubGlobal('fetch', fetchMock);

    server.onMessage(JSON.stringify({ type: 'updateStatementsPool', conversationId: 'abc123' }), conn);

    await vi.waitFor(() => expect(lastBroadcast().type).toBe('statementsPoolUpdated'));
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('conversation_id=abc123'));
    expect(lastBroadcast().statementsPool).toEqual(statements);
  });

  it('honours a custom baseUrl for the Polis fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal('fetch', fetchMock);

    server.onMessage(JSON.stringify({ type: 'updateStatementsPool', conversationId: 'c1', baseUrl: 'https://custom.pol.is' }), conn);

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('https://custom.pol.is/api/v3/comments'));
  });

  it('broadcasts an error when the Polis API responds non-OK', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) }));

    server.onMessage(JSON.stringify({ type: 'updateStatementsPool', conversationId: 'abc' }), conn);

    await vi.waitFor(() => expect(lastBroadcast().type).toBe('statementsPoolError'));
    expect(lastBroadcast().error).toContain('503');
  });

  it('converts inline JSON statements (DefaultStatement → PolisStatement) without fetching', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const json = [{ text: 'Local statement', statementId: 7 }];
    server.onMessage(JSON.stringify({ type: 'updateStatementsPool', json }), conn);

    await vi.waitFor(() => expect(lastBroadcast().type).toBe('statementsPoolUpdated'));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(lastBroadcast().statementsPool[0]).toMatchObject({ txt: 'Local statement', tid: 7, lang: 'en' });
  });
});
