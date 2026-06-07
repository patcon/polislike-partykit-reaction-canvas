import { describe, it, expect, vi } from 'vitest';
import { mapServer } from './server';
import type { PluginConnection, PluginContext } from '../types';
import type { MapProjection } from '../../app/types';

function makeCtx(): PluginContext {
  return {
    broadcast: vi.fn(),
    getCursorPositions: () => new Map(),
    persistState: vi.fn().mockResolvedValue(undefined),
  };
}

function makeConn(id = 'conn-1'): PluginConnection {
  return { id, userId: id, send: vi.fn() };
}

const sampleProjection: MapProjection = {
  coords: [['user-1', [0.1, 0.2]], ['user-2', [0.5, 0.8]]],
  algorithm: 'umap',
  computedAt: '2026-06-07T00:00:00.000Z',
};

describe('mapServer', () => {
  it('createState defaults projection to null', () => {
    expect(mapServer.createState()).toEqual({ projection: null });
  });

  it('onConnect sends current projection to the new connection', () => {
    const state = mapServer.createState();
    state.projection = sampleProjection;
    const conn = makeConn();
    mapServer.onConnect(conn, makeCtx(), state, 'map-viewer');
    expect(conn.send).toHaveBeenCalledOnce();
    expect(JSON.parse((conn.send as ReturnType<typeof vi.fn>).mock.calls[0][0])).toEqual({
      type: 'mapProjectionChanged',
      projection: sampleProjection,
    });
  });

  it('onConnect sends null projection when not yet set', () => {
    const state = mapServer.createState();
    const conn = makeConn();
    mapServer.onConnect(conn, makeCtx(), state, 'map-viewer');
    const msg = JSON.parse((conn.send as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(msg.projection).toBeNull();
  });

  it('onMessage handles mapProjectionSet and broadcasts', () => {
    const state = mapServer.createState();
    const ctx = makeCtx();
    const handled = mapServer.onMessage('mapProjectionSet', { projection: sampleProjection }, makeConn(), ctx, state, 'map-viewer');
    expect(handled).toBe(true);
    expect(state.projection).toEqual(sampleProjection);
    expect(ctx.persistState).toHaveBeenCalled();
    expect(ctx.broadcast).toHaveBeenCalledOnce();
    expect(JSON.parse((ctx.broadcast as ReturnType<typeof vi.fn>).mock.calls[0][0])).toEqual({
      type: 'mapProjectionChanged',
      projection: sampleProjection,
    });
  });

  it('onMessage handles mapProjectionClear and broadcasts null', () => {
    const state = mapServer.createState();
    state.projection = sampleProjection;
    const ctx = makeCtx();
    const handled = mapServer.onMessage('mapProjectionClear', {}, makeConn(), ctx, state, 'map-viewer');
    expect(handled).toBe(true);
    expect(state.projection).toBeNull();
    expect(ctx.persistState).toHaveBeenCalled();
    expect(JSON.parse((ctx.broadcast as ReturnType<typeof vi.fn>).mock.calls[0][0])).toEqual({
      type: 'mapProjectionChanged',
      projection: null,
    });
  });

  it('onMessage returns false for unknown message types', () => {
    const state = mapServer.createState();
    const handled = mapServer.onMessage('unknownEvent', {}, makeConn(), makeCtx(), state, 'map-viewer');
    expect(handled).toBe(false);
  });

  it('getPersistedState returns the projection', () => {
    const state = mapServer.createState();
    state.projection = sampleProjection;
    expect(mapServer.getPersistedState!(state)).toEqual({ projection: sampleProjection });
  });

  it('applyPersistedState restores saved projection', () => {
    const state = mapServer.createState();
    mapServer.applyPersistedState!(state, { projection: sampleProjection });
    expect(state.projection).toEqual(sampleProjection);
  });

  it('applyPersistedState restores null projection', () => {
    const state = mapServer.createState();
    state.projection = sampleProjection;
    mapServer.applyPersistedState!(state, { projection: null });
    expect(state.projection).toBeNull();
  });

  it('applyPersistedState ignores missing projection field', () => {
    const state = mapServer.createState();
    state.projection = sampleProjection;
    mapServer.applyPersistedState!(state, {});
    expect(state.projection).toEqual(sampleProjection);
  });
});
