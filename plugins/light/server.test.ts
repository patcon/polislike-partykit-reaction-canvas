import { describe, it, expect, vi } from 'vitest';
import { lightServer } from './server';
import { makeCtx, makeConn } from '../testHelpers';

describe('lightServer', () => {
  it('createState defaults to black at full brightness', () => {
    expect(lightServer.createState()).toEqual({ color: '#000000', brightness: 100 });
  });

  it('onConnect sends current light state to the new connection', () => {
    const state = lightServer.createState();
    state.color = '#ff0000';
    state.brightness = 75;
    const conn = makeConn();
    lightServer.onConnect(conn, makeCtx(), state, 'screen-light');
    expect(conn.send).toHaveBeenCalledOnce();
    expect(JSON.parse((conn.send as ReturnType<typeof vi.fn>).mock.calls[0][0])).toEqual({
      type: 'screenLightState',
      color: '#ff0000',
      brightness: 75,
    });
  });

  it('onMessage handles setLightColor and broadcasts lightColor', () => {
    const state = lightServer.createState();
    const ctx = makeCtx();
    const handled = lightServer.onMessage('setLightColor', { color: '#00ff00', brightness: 50 }, makeConn(), ctx, state, 'screen-light');
    expect(handled).toBe(true);
    expect(state.color).toBe('#00ff00');
    expect(state.brightness).toBe(50);
    expect(ctx.broadcast).toHaveBeenCalledOnce();
    expect(JSON.parse((ctx.broadcast as ReturnType<typeof vi.fn>).mock.calls[0][0])).toEqual({
      type: 'lightColor',
      color: '#00ff00',
      brightness: 50,
    });
  });

  it('onMessage does not persist state (light is not persisted on change)', () => {
    const state = lightServer.createState();
    const ctx = makeCtx();
    lightServer.onMessage('setLightColor', { color: '#ffffff', brightness: 100 }, makeConn(), ctx, state, 'screen-light');
    expect(ctx.persistState).not.toHaveBeenCalled();
  });

  it('onMessage returns false for unknown message types', () => {
    const state = lightServer.createState();
    const handled = lightServer.onMessage('unknownEvent', {}, makeConn(), makeCtx(), state, 'screen-light');
    expect(handled).toBe(false);
  });

  it('getPersistedState returns color and brightness', () => {
    const state = lightServer.createState();
    state.color = '#123456';
    state.brightness = 42;
    expect(lightServer.getPersistedState!(state)).toEqual({ color: '#123456', brightness: 42 });
  });

  it('applyPersistedState restores color and brightness', () => {
    const state = lightServer.createState();
    lightServer.applyPersistedState!(state, { color: '#abcdef', brightness: 80 });
    expect(state.color).toBe('#abcdef');
    expect(state.brightness).toBe(80);
  });

  it('applyPersistedState ignores missing fields', () => {
    const state = lightServer.createState();
    state.color = '#111111';
    state.brightness = 60;
    lightServer.applyPersistedState!(state, {});
    expect(state.color).toBe('#111111');
    expect(state.brightness).toBe(60);
  });
});
