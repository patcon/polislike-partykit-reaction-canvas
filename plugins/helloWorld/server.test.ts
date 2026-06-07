import { describe, it, expect, vi } from 'vitest';
import { HelloWorldServerPlugin } from './server';
import type { PluginConnection, PluginContext } from '../types';

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

describe('HelloWorldServerPlugin', () => {
  it('createState defaults message to Hello, world!', () => {
    expect(HelloWorldServerPlugin.createState()).toEqual({ message: 'Hello, world!' });
  });

  it('onConnect sends current message to the new connection', () => {
    const state = HelloWorldServerPlugin.createState();
    state.message = 'Hi there!';
    const conn = makeConn();
    HelloWorldServerPlugin.onConnect(conn, makeCtx(), state, 'helloWorld');
    expect(conn.send).toHaveBeenCalledOnce();
    expect(JSON.parse((conn.send as ReturnType<typeof vi.fn>).mock.calls[0][0])).toEqual({
      type: 'helloWorldState',
      message: 'Hi there!',
    });
  });

  it('onMessage handles setHelloWorldMessage and broadcasts to all', () => {
    const state = HelloWorldServerPlugin.createState();
    const ctx = makeCtx();
    const handled = HelloWorldServerPlugin.onMessage('setHelloWorldMessage', { message: 'Howdy!' }, makeConn(), ctx, state, 'helloWorld');
    expect(handled).toBe(true);
    expect(state.message).toBe('Howdy!');
    expect(ctx.broadcast).toHaveBeenCalledOnce();
    expect(JSON.parse((ctx.broadcast as ReturnType<typeof vi.fn>).mock.calls[0][0])).toEqual({
      type: 'helloWorldState',
      message: 'Howdy!',
    });
    expect(ctx.persistState).toHaveBeenCalled();
  });

  it('onMessage returns false for unknown message types', () => {
    const state = HelloWorldServerPlugin.createState();
    const handled = HelloWorldServerPlugin.onMessage('unknownEvent', {}, makeConn(), makeCtx(), state, 'helloWorld');
    expect(handled).toBe(false);
  });

  it('getPersistedState returns the message', () => {
    const state = HelloWorldServerPlugin.createState();
    state.message = 'Persisted!';
    expect(HelloWorldServerPlugin.getPersistedState!(state)).toEqual({ message: 'Persisted!' });
  });

  it('applyPersistedState restores saved message', () => {
    const state = HelloWorldServerPlugin.createState();
    HelloWorldServerPlugin.applyPersistedState!(state, { message: 'Restored!' });
    expect(state.message).toBe('Restored!');
  });

  it('applyPersistedState ignores null saved state', () => {
    const state = HelloWorldServerPlugin.createState();
    HelloWorldServerPlugin.applyPersistedState!(state, null);
    expect(state.message).toBe('Hello, world!');
  });
});
