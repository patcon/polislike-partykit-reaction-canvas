import { describe, it, expect, vi } from 'vitest';
import { SoccerServerPlugin, getSoccerScore } from './server';
import { SOCCER_RESET_SCORE } from './types';
import { makeCtx, makeConn } from '../testHelpers';

describe('SoccerServerPlugin', () => {
  it('createState returns an engine with initial score 0-0', () => {
    const state = SoccerServerPlugin.createState();
    const score = getSoccerScore(state);
    expect(score).toEqual({ left: 0, right: 0 });
  });

  it('onMessage handles resetSoccerScore and returns true', () => {
    const state = SoccerServerPlugin.createState();
    const ctx = makeCtx();
    const conn = makeConn();
    const handled = SoccerServerPlugin.onMessage(SOCCER_RESET_SCORE, {}, conn, ctx, state, 'soccer');
    expect(handled).toBe(true);
  });

  it('onMessage returns false for unrecognised message types', () => {
    const state = SoccerServerPlugin.createState();
    const ctx = makeCtx();
    const conn = makeConn();
    const handled = SoccerServerPlugin.onMessage('move', {}, conn, ctx, state, 'canvas');
    expect(handled).toBe(false);
  });

  it('onConnect sends ballState when currentScreenPanel is soccer', () => {
    const state = SoccerServerPlugin.createState();
    const ctx = makeCtx();
    const conn = makeConn();
    SoccerServerPlugin.onConnect(conn, ctx, state, 'soccer');
    expect(conn.send).toHaveBeenCalledOnce();
    const msg = JSON.parse((conn.send as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(msg.type).toBe('ballState');
  });

  it('onConnect sends nothing when currentScreenPanel is not soccer', () => {
    const state = SoccerServerPlugin.createState();
    const ctx = makeCtx();
    const conn = makeConn();
    SoccerServerPlugin.onConnect(conn, ctx, state, 'canvas');
    expect(conn.send).not.toHaveBeenCalled();
  });
});
