import { describe, it, expect } from 'vitest';
import { GreeterServerPlugin } from './server';
import { makeCtx, makeConn, lastSent, lastBroadcast } from '../testHelpers';

describe('GreeterServerPlugin', () => {
  it('createState defaults config to null', () => {
    expect(GreeterServerPlugin.createState()).toEqual({ config: null });
  });

  it('onConnect sends current config to the new connection', () => {
    const state = GreeterServerPlugin.createState();
    state.config = { eventUrl: 'https://example.com/event' };
    const conn = makeConn();
    GreeterServerPlugin.onConnect(conn, makeCtx(), state, 'greeter');
    expect(lastSent(conn)).toEqual({ type: 'greeterConfigChanged', config: { eventUrl: 'https://example.com/event' } });
  });

  it('onConnect sends null config when not yet set', () => {
    const state = GreeterServerPlugin.createState();
    const conn = makeConn();
    GreeterServerPlugin.onConnect(conn, makeCtx(), state, 'greeter');
    expect((lastSent(conn) as { config: unknown }).config).toBeNull();
  });

  it('onMessage handles setGreeterConfig and broadcasts to all', () => {
    const state = GreeterServerPlugin.createState();
    const ctx = makeCtx();
    const config = { eventUrl: 'https://example.com/event' };
    const handled = GreeterServerPlugin.onMessage('setGreeterConfig', { config }, makeConn(), ctx, state, 'greeter');
    expect(handled).toBe(true);
    expect(state.config).toEqual(config);
    expect(lastBroadcast(ctx)).toEqual({ type: 'greeterConfigChanged', config });
    expect(ctx.persistState).toHaveBeenCalled();
  });

  it('onMessage handles setGreeterConfig with null to clear', () => {
    const state = GreeterServerPlugin.createState();
    state.config = { eventUrl: 'https://example.com/event' };
    GreeterServerPlugin.onMessage('setGreeterConfig', { config: null }, makeConn(), makeCtx(), state, 'greeter');
    expect(state.config).toBeNull();
  });

  it('onMessage returns false for unknown message types', () => {
    const state = GreeterServerPlugin.createState();
    expect(GreeterServerPlugin.onMessage('unknownEvent', {}, makeConn(), makeCtx(), state, 'greeter')).toBe(false);
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

  it('applyPersistedState ignores null saved state', () => {
    const state = GreeterServerPlugin.createState();
    state.config = { eventUrl: 'https://example.com/event' };
    GreeterServerPlugin.applyPersistedState!(state, null);
    expect(state.config).toEqual({ eventUrl: 'https://example.com/event' });
  });
});
