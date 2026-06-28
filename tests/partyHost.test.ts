import { describe, it, expect, afterEach, vi } from 'vitest';
import { getPartySocketConfig, getPartyHost } from '../app/utils/partyHost';

function mockLocation(loc: { port: string; hostname: string; protocol: string }) {
  vi.stubGlobal('window', { location: loc });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getPartySocketConfig', () => {
  it('connects to the local dev server on port 1999 with ws over HTTP', () => {
    mockLocation({ port: '1999', hostname: '10.0.0.5', protocol: 'http:' });
    expect(getPartySocketConfig()).toEqual({ host: '10.0.0.5:1999', protocol: 'ws' });
  });

  it('uses wss on port 1999 when the page is served over HTTPS', () => {
    mockLocation({ port: '1999', hostname: 'localhost', protocol: 'https:' });
    expect(getPartySocketConfig()).toEqual({ host: 'localhost:1999', protocol: 'wss' });
  });

  it('returns the deployed host with wss on any other port', () => {
    mockLocation({ port: '', hostname: 'app.example.partykit.dev', protocol: 'https:' });
    expect(getPartySocketConfig()).toEqual({ host: 'app.example.partykit.dev', protocol: 'wss' });
  });
});

describe('getPartyHost', () => {
  it('returns just the host from the socket config', () => {
    mockLocation({ port: '1999', hostname: '192.168.1.2', protocol: 'http:' });
    expect(getPartyHost()).toBe('192.168.1.2:1999');
  });
});
