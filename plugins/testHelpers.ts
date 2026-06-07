import { vi } from 'vitest';
import type { PluginConnection, PluginContext } from './types';

export function makeCtx(): PluginContext {
  return {
    broadcast: vi.fn(),
    getCursorPositions: () => new Map(),
    persistState: vi.fn().mockResolvedValue(undefined),
  };
}

export function makeConn(id = 'conn-1'): PluginConnection {
  return { id, userId: id, send: vi.fn() };
}

export function lastSent(conn: PluginConnection): unknown {
  return JSON.parse((conn.send as ReturnType<typeof vi.fn>).mock.calls.at(-1)[0]);
}

export function lastBroadcast(ctx: PluginContext): unknown {
  return JSON.parse((ctx.broadcast as ReturnType<typeof vi.fn>).mock.calls.at(-1)[0]);
}
