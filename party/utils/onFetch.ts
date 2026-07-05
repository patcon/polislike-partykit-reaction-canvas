import type * as Party from "partykit/server";

// SPA fallback: serve static assets directly; only fall back to index.html
// for extensionless paths (room names). This prevents .html pages in public/
// from being swallowed by the SPA router.
export async function onFetch(req: Party.Request, lobby: Party.FetchLobby) {
  const url = new URL(req.url);

  // Diagnostic: confirms onFetch is being called and shows lobby.assets.fetch behaviour.
  // Remove once the routing/serving issue is understood.
  if (url.pathname === '/__debug-fetch') {
    const indexAsset = await lobby.assets.fetch('/index.html');
    return new Response(JSON.stringify({
      onFetchCalled: true,
      indexHtmlStatus: indexAsset?.status ?? null,
      indexHtmlOk: indexAsset?.ok ?? null,
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  const hasExtension = url.pathname.includes('.');

  const asset = await lobby.assets.fetch(url.pathname);
  if (asset?.ok) return asset;
  if (hasExtension) return new Response('Not found', { status: 404 });
  // lobby.assets.fetch returns null in dev mode (static files are served before onFetch);
  // fall back to a direct fetch so the SPA shell loads for room paths like /default.
  const index = await lobby.assets.fetch('/index.html');
  if (index?.ok) return index;
  return fetch(new URL('/index.html', req.url).toString());
}
