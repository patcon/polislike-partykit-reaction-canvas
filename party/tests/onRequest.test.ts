/**
 * HTTP surface tests for the PartyKit server: the `onRequest` REST endpoints
 * (github submissions, debug-state).
 *
 * Plugins are mocked out to an empty registry so these tests exercise only the
 * server's own request handling, not plugin `onRequest` delegation (which is a
 * separate contract).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type * as Party from 'partykit/server';
import Server from '../server';
import { createMockRoom } from './helpers/mockParty';

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
