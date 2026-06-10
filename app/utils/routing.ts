// Returns the canonical href to redirect to, or null if no redirect is needed.
// `hash` is TanStack Router's location.hash — no leading '#'.

export function getIndexRedirect(search: string, hash: string): string | null {
  const params = new URLSearchParams(search);
  const room = params.get('room');
  params.delete('room');
  const qs = params.toString() ? `?${params}` : '';

  if (room) {
    if (!hash || hash === 'v4') return `/${room}${qs}`;
    return `/${room}${qs}#${hash}`;
  }
  if (hash === 'v4') return `/default${qs}`;
  if (hash && hash !== 'old') return `/default${qs}#${hash}`;
  return null;
}

export function getRoomRedirect(pathname: string, search: string, hash: string): string | null {
  if (pathname.endsWith('.html')) return null;
  const params = new URLSearchParams(search);
  const roomParam = params.get('room');
  params.delete('room');
  const qs = params.toString() ? `?${params}` : '';

  if (roomParam) {
    if (!hash || hash === 'v4') return `/${roomParam}${qs}`;
    return `/${roomParam}${qs}#${hash}`;
  }
  if (hash === 'v4') return `${pathname}${qs}`;
  return null;
}
