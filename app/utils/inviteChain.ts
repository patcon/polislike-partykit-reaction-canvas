export function parseInviteChain(search: string): string[] {
  const raw = new URLSearchParams(search).get('inviteChain');
  if (!raw) return [];
  return raw.split(',').filter(Boolean);
}

export function appendSelfToChain(chain: string[], selfId: string): string[] {
  if (chain.includes(selfId)) return chain;
  return [...chain, selfId];
}

export function chainToEdges(chain: string[]): Array<[string, string]> {
  const edges: Array<[string, string]> = [];
  for (let i = 0; i < chain.length - 1; i++) {
    edges.push([chain[i], chain[i + 1]]);
  }
  return edges;
}

export function getStoredChain(room: string): string[] {
  try {
    const raw = localStorage.getItem(`treevites-chain-${room}`);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function storeChain(room: string, chain: string[]): void {
  try {
    localStorage.setItem(`treevites-chain-${room}`, JSON.stringify(chain));
  } catch {
    // ignore storage errors
  }
}

export function buildInviteChainUrl(baseSearch: string, selfId: string, selfChain: string[]): string {
  const p = new URLSearchParams(baseSearch);
  const outgoing = appendSelfToChain(selfChain, selfId);
  p.set('inviteChain', outgoing.join(','));
  return p.toString();
}
