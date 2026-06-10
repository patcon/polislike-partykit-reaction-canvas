import { describe, it, expect, vi } from 'vitest';
import { onFetch } from './onFetch';
import type * as Party from 'partykit/server';

function makeLobby(assetResponse: Response | null) {
  return {
    assets: { fetch: vi.fn().mockResolvedValue(assetResponse) },
  } as unknown as Party.FetchLobby;
}

function makeRequest(path: string) {
  return new Request(`https://example.com${path}`) as unknown as Party.Request;
}

async function fetch(path: string, lobby: Party.FetchLobby) {
  return (await onFetch(makeRequest(path), lobby)) as Response;
}

describe('onFetch', () => {
  describe('static assets with extensions', () => {
    it('serves an existing .html file directly', async () => {
      const file = new Response('<html>onboarding</html>', { status: 200 });
      const lobby = makeLobby(file);
      const res = await fetch('/some-page.html', lobby);
      expect(res.status).toBe(200);
      expect((lobby.assets.fetch as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('/some-page.html');
    });

    it('returns 404 for a missing .html file', async () => {
      const res = await fetch('/missing-page.html', makeLobby(null));
      expect(res.status).toBe(404);
    });

    it('serves an existing JS asset', async () => {
      const file = new Response('console.log(1)', { status: 200 });
      const res = await fetch('/dist/client.js', makeLobby(file));
      expect(res.status).toBe(200);
    });

    it('returns 404 for a missing JS asset', async () => {
      const res = await fetch('/dist/missing.js', makeLobby(null));
      expect(res.status).toBe(404);
    });
  });

  describe('extensionless paths (room names)', () => {
    it('falls back to index.html for a room path', async () => {
      const indexHtml = new Response('<html>app</html>', { status: 200 });
      const lobby = {
        assets: {
          fetch: vi.fn()
            .mockResolvedValueOnce(null)       // no static asset for /test-room
            .mockResolvedValueOnce(indexHtml), // index.html fallback
        },
      } as unknown as Party.FetchLobby;
      const res = await fetch('/test-room', lobby);
      expect(res.status).toBe(200);
      expect((lobby.assets.fetch as ReturnType<typeof vi.fn>)).toHaveBeenNthCalledWith(1, '/test-room');
      expect((lobby.assets.fetch as ReturnType<typeof vi.fn>)).toHaveBeenNthCalledWith(2, '/index.html');
    });

    it('falls back to index.html for the root path', async () => {
      const indexHtml = new Response('<html>app</html>', { status: 200 });
      const lobby = {
        assets: {
          fetch: vi.fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(indexHtml),
        },
      } as unknown as Party.FetchLobby;
      const res = await fetch('/', lobby);
      expect(res.status).toBe(200);
      expect((lobby.assets.fetch as ReturnType<typeof vi.fn>)).toHaveBeenNthCalledWith(2, '/index.html');
    });
  });
});
