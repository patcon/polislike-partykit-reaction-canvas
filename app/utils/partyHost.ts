/**
 * Returns host and protocol config for usePartySocket.
 *
 * partysocket strips any protocol prefix from `host` and then re-determines
 * ws vs wss based on whether the hostname looks like a private/LAN address —
 * so LAN IPs (192.168.x.x) always get ws:// regardless of the page protocol.
 * Passing `protocol` explicitly overrides that detection.
 *
 * On port 1999 (local partykit dev) we connect to the local server and use
 * wss when the page is on HTTPS (e.g. pnpm dev-https) to avoid mixed content.
 * On any other port we return the deployed hostname; partysocket's default
 * detection (non-LAN → wss) is correct there.
 */
export function getPartySocketConfig(): { host: string; protocol: 'ws' | 'wss' } {
  if (window.location.port === '1999') {
    return {
      host: `${window.location.hostname}:1999`,
      protocol: window.isSecureContext ? 'wss' : 'ws',
    };
  }
  return {
    host: window.location.hostname,
    protocol: 'wss',
  };
}

/** @deprecated Use getPartySocketConfig() and spread both host and protocol. */
export function getPartyHost(): string {
  return getPartySocketConfig().host;
}
