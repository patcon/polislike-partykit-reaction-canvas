/**
 * Returns the PartyKit host string for usePartySocket.
 * On port 1999 (local partykit dev), connects to the local server,
 * using wss:// when the page is served over HTTPS (e.g. pnpm dev-https)
 * so browsers don't block the WebSocket as mixed content.
 * On any other port, returns just the hostname so partysocket uses
 * the deployed server with its own protocol detection.
 */
export function getPartyHost(): string {
  if (window.location.port === '1999') {
    const protocol = window.isSecureContext ? 'wss' : 'ws';
    return `${protocol}://${window.location.hostname}:1999`;
  }
  return window.location.hostname;
}
