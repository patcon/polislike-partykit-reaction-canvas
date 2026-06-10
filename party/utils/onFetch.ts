import type * as Party from "partykit/server";

// SPA fallback: serve static assets directly; only fall back to index.html
// for extensionless paths (room names). This prevents .html pages in public/
// from being swallowed by the SPA router.
export async function onFetch(req: Party.Request, lobby: Party.FetchLobby) {
  const url = new URL(req.url);
  const hasExtension = url.pathname.includes('.');

  const asset = await lobby.assets.fetch(url.pathname);
  if (asset) return asset;
  if (hasExtension) return new Response('Not found', { status: 404 });
  return lobby.assets.fetch('/index.html');
}
