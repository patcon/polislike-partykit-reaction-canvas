import { describe, it, expect, vi } from 'vitest';
import { ArrivalCanvasServerPlugin } from '../plugins/arrivalCanvas/server';
import type { PluginConnection, PluginContext } from '../plugins/types';

function makeCtx(): PluginContext {
  return {
    broadcast: vi.fn(),
    getCursorPositions: () => new Map(),
    persistState: vi.fn().mockResolvedValue(undefined),
  };
}

function makeConn(id = 'conn-1'): PluginConnection {
  return { id, send: vi.fn() };
}

describe('ArrivalCanvasServerPlugin', () => {
  it('createState defaults capacity to 50', () => {
    expect(ArrivalCanvasServerPlugin.createState()).toEqual({ capacity: 50 });
  });

  it('onConnect pushes current capacity to the new connection', () => {
    const state = ArrivalCanvasServerPlugin.createState();
    state.capacity = 80;
    const conn = makeConn();
    ArrivalCanvasServerPlugin.onConnect(conn, makeCtx(), state, 'arrival-canvas');
    expect(conn.send).toHaveBeenCalledOnce();
    expect(JSON.parse((conn.send as ReturnType<typeof vi.fn>).mock.calls[0][0])).toEqual({
      type: 'arrivalCapacityChanged', capacity: 80,
    });
  });

  it('onMessage updates capacity, broadcasts, persists, and returns true', () => {
    const state = ArrivalCanvasServerPlugin.createState();
    const ctx = makeCtx();
    const handled = ArrivalCanvasServerPlugin.onMessage(
      'setArrivalCapacity', { capacity: 120 }, makeConn(), ctx, state, 'arrival-canvas',
    );
    expect(handled).toBe(true);
    expect(state.capacity).toBe(120);
    expect(JSON.parse((ctx.broadcast as ReturnType<typeof vi.fn>).mock.calls[0][0])).toEqual({
      type: 'arrivalCapacityChanged', capacity: 120,
    });
    expect(ctx.persistState).toHaveBeenCalledOnce();
  });

  it('onMessage returns false for unrelated message types', () => {
    const state = ArrivalCanvasServerPlugin.createState();
    const handled = ArrivalCanvasServerPlugin.onMessage('move', {}, makeConn(), makeCtx(), state, 'canvas');
    expect(handled).toBe(false);
  });

  it('persist round-trips capacity', () => {
    const state = ArrivalCanvasServerPlugin.createState();
    state.capacity = 33;
    const saved = ArrivalCanvasServerPlugin.getPersistedState!(state);
    const restored = ArrivalCanvasServerPlugin.createState();
    ArrivalCanvasServerPlugin.applyPersistedState!(restored, saved);
    expect(restored.capacity).toBe(33);
  });
});
