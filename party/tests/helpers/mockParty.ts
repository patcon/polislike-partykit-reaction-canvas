import { vi } from 'vitest';
import type * as Party from 'partykit/server';

export function createMockConnection(id: string) {
  const send = vi.fn();
  const conn = { id, send } as unknown as Party.Connection;
  return { conn, send };
}

export function createMockRoom(connections: Party.Connection[] = []) {
  const broadcast = vi.fn();
  const room = {
    id: 'test-room',
    env: {} as Record<string, unknown>,
    broadcast,
    getConnections: () => connections[Symbol.iterator](),
    getConnection: (id: string) => connections.find(c => c.id === id),
    storage: {
      get: vi.fn().mockResolvedValue(undefined),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    },
  } as unknown as Party.Room;
  return { room, broadcast };
}

export function makeConnectCtx(userId: string, opts: { isAdmin?: boolean; host?: string } = {}): Party.ConnectionContext {
  const params = new URLSearchParams({ userId });
  if (opts.isAdmin) params.set('isAdmin', 'true');
  const host = opts.host ?? 'test.example.com';
  return {
    request: { url: `https://${host}/?${params}` } as unknown as Party.Request,
  };
}
