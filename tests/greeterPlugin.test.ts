import { describe, it, expect, vi } from 'vitest';
import { GreeterServerPlugin } from '../plugins/greeter/server';
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

describe('GreeterServerPlugin', () => {
  it('createState defaults config to null', () => {
    expect(GreeterServerPlugin.createState()).toEqual({ config: null });
  });

  it('onConnect sends current config to the new connection', () => {
    const state = GreeterServerPlugin.createState();
    state.config = { eventUrl: 'https://example.com/event' };
    const conn = makeConn();
    GreeterServerPlugin.onConnect(conn, makeCtx(), state);
    expect(conn.send).toHaveBeenCalledOnce();
    expect(JSON.parse((conn.send as ReturnType<typeof vi.fn>).mock.calls[0][0])).toEqual({
      type: 'greeterConfigChanged',
      config: { eventUrl: 'https://example.com/event' },
    });
  });

  it('onConnect sends null config when not yet set', () => {
    const state = GreeterServerPlugin.createState();
    const conn = makeConn();
    GreeterServerPlugin.onConnect(conn, makeCtx(), state);
    const msg = JSON.parse((conn.send as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(msg.config).toBeNull();
  });

  it('onMessage handles setGreeterConfig and broadcasts to all', () => {
    const state = GreeterServerPlugin.createState();
    const ctx = makeCtx();
    const conn = makeConn();
    const config = { eventUrl: 'https://example.com/event' };
    const handled = GreeterServerPlugin.onMessage('setGreeterConfig', { config }, conn, ctx, state);
    expect(handled).toBe(true);
    expect(state.config).toEqual(config);
    expect(ctx.broadcast).toHaveBeenCalledOnce();
    expect(JSON.parse((ctx.broadcast as ReturnType<typeof vi.fn>).mock.calls[0][0])).toEqual({
      type: 'greeterConfigChanged',
      config,
    });
    expect(ctx.persistState).toHaveBeenCalled();
  });

  it('onMessage handles setGreeterConfig with null to clear', () => {
    const state = GreeterServerPlugin.createState();
    state.config = { eventUrl: 'https://example.com/event' };
    const ctx = makeCtx();
    GreeterServerPlugin.onMessage('setGreeterConfig', { config: null }, makeConn(), ctx, state);
    expect(state.config).toBeNull();
  });

  it('onMessage returns false for unknown message types', () => {
    const state = GreeterServerPlugin.createState();
    const handled = GreeterServerPlugin.onMessage('unknownEvent', {}, makeConn(), makeCtx(), state);
    expect(handled).toBe(false);
  });

  it('getPersistedState returns config', () => {
    const state = GreeterServerPlugin.createState();
    state.config = { eventUrl: 'https://example.com/event' };
    expect(GreeterServerPlugin.getPersistedState!(state)).toEqual({ config: { eventUrl: 'https://example.com/event' } });
  });

  it('applyPersistedState restores saved config', () => {
    const state = GreeterServerPlugin.createState();
    GreeterServerPlugin.applyPersistedState!(state, { config: { eventUrl: 'https://restored.com' } });
    expect(state.config).toEqual({ eventUrl: 'https://restored.com' });
  });

  it('applyPersistedState ignores null/missing saved state', () => {
    const state = GreeterServerPlugin.createState();
    state.config = { eventUrl: 'https://example.com/event' };
    GreeterServerPlugin.applyPersistedState!(state, null);
    expect(state.config).toEqual({ eventUrl: 'https://example.com/event' });
  });
});
