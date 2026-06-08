import { vi } from 'vitest';
import type { PluginConnection, PluginContext } from './types';

export function makeCtx(): PluginContext {
  return {
    broadcast: vi.fn(),
    sendToUser: vi.fn(),
    getCursorPositions: () => new Map(),
    persistState: vi.fn().mockResolvedValue(undefined),
  };
}

export function makeConn(id = 'conn-1', userId?: string): PluginConnection {
  return { id, userId: userId ?? id, send: vi.fn() };
}

export function lastSent(conn: PluginConnection): unknown {
  const calls = (conn.send as ReturnType<typeof vi.fn>).mock.calls;
  return JSON.parse(calls[calls.length - 1][0]);
}

export function lastBroadcast(ctx: PluginContext): unknown {
  const calls = (ctx.broadcast as ReturnType<typeof vi.fn>).mock.calls;
  return JSON.parse(calls[calls.length - 1][0]);
}
