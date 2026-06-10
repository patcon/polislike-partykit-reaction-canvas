import { describe, it, expect, vi } from 'vitest';
import { lightServer } from './server';
import { makeCtx, makeConn } from '../testHelpers';

describe('lightServer', () => {
  it('createState defaults to global black at full brightness', () => {
    expect(lightServer.createState()).toEqual({ current: { mode: 'global', color: '#000000', brightness: 100 } });
  });

  it('onConnect sends current global light state to the new connection', () => {
    const state = lightServer.createState();
    (state.current as any).color = '#ff0000';
    (state.current as any).brightness = 75;
    const conn = makeConn();
    lightServer.onConnect(conn, makeCtx(), state, 'screen-light');
    expect(conn.send).toHaveBeenCalledOnce();
    expect(JSON.parse((conn.send as ReturnType<typeof vi.fn>).mock.calls[0][0])).toEqual({
      type: 'setBatchScreenLight',
      mode: 'global',
      color: '#ff0000',
      brightness: 75,
    });
  });

  it('onConnect sends perParticipant state when a program is active', () => {
    const state = lightServer.createState();
    state.current = { mode: 'perParticipant', colors: { 'user-1': { color: '#00ff00', brightness: 100 } } };
    const conn = makeConn();
    lightServer.onConnect(conn, makeCtx(), state, 'screen-light');
    expect(JSON.parse((conn.send as ReturnType<typeof vi.fn>).mock.calls[0][0])).toEqual({
      type: 'setBatchScreenLight',
      mode: 'perParticipant',
      colors: { 'user-1': { color: '#00ff00', brightness: 100 } },
    });
  });

  it('onMessage handles global setBatchScreenLight and broadcasts it', () => {
    const state = lightServer.createState();
    const ctx = makeCtx();
    const payload = { mode: 'global', color: '#00ff00', brightness: 50 };
    const handled = lightServer.onMessage('setBatchScreenLight', payload, makeConn(), ctx, state, 'screen-light');
    expect(handled).toBe(true);
    expect(state.current).toEqual({ mode: 'global', color: '#00ff00', brightness: 50 });
    expect(ctx.broadcast).toHaveBeenCalledOnce();
    expect(JSON.parse((ctx.broadcast as ReturnType<typeof vi.fn>).mock.calls[0][0])).toEqual({
      type: 'setBatchScreenLight',
      mode: 'global',
      color: '#00ff00',
      brightness: 50,
    });
  });

  it('onMessage handles perParticipant setBatchScreenLight and broadcasts it', () => {
    const state = lightServer.createState();
    const ctx = makeCtx();
    const colors = { 'user-1': { color: '#003300', brightness: 100 } };
    const payload = { mode: 'perParticipant', colors };
    const handled = lightServer.onMessage('setBatchScreenLight', payload, makeConn(), ctx, state, 'screen-light');
    expect(handled).toBe(true);
    expect(state.current).toEqual({ mode: 'perParticipant', colors });
    expect(JSON.parse((ctx.broadcast as ReturnType<typeof vi.fn>).mock.calls[0][0])).toEqual({
      type: 'setBatchScreenLight',
      mode: 'perParticipant',
      colors,
    });
  });

  it('onMessage does not call persistState', () => {
    const state = lightServer.createState();
    const ctx = makeCtx();
    lightServer.onMessage('setBatchScreenLight', { mode: 'global', color: '#ffffff', brightness: 100 }, makeConn(), ctx, state, 'screen-light');
    expect(ctx.persistState).not.toHaveBeenCalled();
  });

  it('onMessage returns false for unknown message types', () => {
    const state = lightServer.createState();
    const handled = lightServer.onMessage('unknownEvent', {}, makeConn(), makeCtx(), state, 'screen-light');
    expect(handled).toBe(false);
  });
});
