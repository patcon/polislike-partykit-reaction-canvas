import { describe, it, expect, vi } from 'vitest';
import { onFetch } from './onFetch';

function makeLobby(assetResponse: Response | null) {
  return {
    assets: {
      fetch: vi.fn().mockResolvedValue(assetResponse),
    },
  };
}

function makeRequest(path: string) {
  return new Request(`https://example.com${path}`);
}

describe('onFetch', () => {
  describe('static assets with extensions', () => {
    it('serves an existing .html file directly', async () => {
      const file = new Response('<html>onboarding</html>', { status: 200 });
      const lobby = makeLobby(file);
      const res = await onFetch(makeRequest('/some-page.html'), lobby as any);
      expect(res.status).toBe(200);
      expect(lobby.assets.fetch).toHaveBeenCalledWith('/some-page.html');
    });

    it('returns 404 for a missing .html file', async () => {
      const lobby = makeLobby(null);
      const res = await onFetch(makeRequest('/missing-page.html'), lobby as any);
      expect(res.status).toBe(404);
    });

    it('serves an existing JS asset', async () => {
      const file = new Response('console.log(1)', { status: 200 });
      const lobby = makeLobby(file);
      const res = await onFetch(makeRequest('/dist/client.js'), lobby as any);
      expect(res.status).toBe(200);
    });

    it('returns 404 for a missing JS asset', async () => {
      const lobby = makeLobby(null);
      const res = await onFetch(makeRequest('/dist/missing.js'), lobby as any);
      expect(res.status).toBe(404);
    });
  });

  describe('extensionless paths (room names)', () => {
    it('falls back to index.html for a room path', async () => {
      const indexHtml = new Response('<html>app</html>', { status: 200 });
      const lobby = {
        assets: {
          fetch: vi.fn()
            .mockResolvedValueOnce(null)        // no static asset for /test-room
            .mockResolvedValueOnce(indexHtml),  // index.html fallback
        },
      };
      const res = await onFetch(makeRequest('/test-room'), lobby as any);
      expect(res.status).toBe(200);
      expect(lobby.assets.fetch).toHaveBeenNthCalledWith(1, '/test-room');
      expect(lobby.assets.fetch).toHaveBeenNthCalledWith(2, '/index.html');
    });

    it('falls back to index.html for the root path', async () => {
      const indexHtml = new Response('<html>app</html>', { status: 200 });
      const lobby = {
        assets: {
          fetch: vi.fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(indexHtml),
        },
      };
      const res = await onFetch(makeRequest('/'), lobby as any);
      expect(res.status).toBe(200);
      expect(lobby.assets.fetch).toHaveBeenNthCalledWith(2, '/index.html');
    });
  });
});
