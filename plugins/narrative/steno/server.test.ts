import { describe, it, expect, vi } from 'vitest';
import { stenoServer } from './server';
import { makeCtx, makeConn } from '../../testHelpers';
import type { StenoState } from '../types';

function makeState(): StenoState {
  return stenoServer.createState();
}

function sent(conn: ReturnType<typeof makeConn>): unknown[] {
  return (conn.send as ReturnType<typeof vi.fn>).mock.calls.map((c) => JSON.parse(c[0]));
}

describe('stenoServer', () => {
  describe('createState', () => {
    it('initializes with WEBVTT header, null lock, empty connUsers', () => {
      const state = makeState();
      expect(state.vtt).toContain('WEBVTT');
      expect(state.lockUserId).toBeNull();
      expect(state.connUsers.size).toBe(0);
    });
  });

  describe('onConnect', () => {
    it('sends stenoTextChanged with current vtt', () => {
      const conn = makeConn('c1', 'alice');
      stenoServer.onConnect(conn, makeCtx(), makeState(), 'steno');
      expect(sent(conn)).toContainEqual(expect.objectContaining({ type: 'stenoTextChanged' }));
    });

    it('sends stenoLockAcquired when a lock is held', () => {
      const conn = makeConn('c1', 'alice');
      const state = makeState();
      state.lockUserId = 'bob';
      stenoServer.onConnect(conn, makeCtx(), state, 'steno');
      expect(sent(conn)).toContainEqual({ type: 'stenoLockAcquired', userId: 'bob' });
    });

    it('does not send stenoLockAcquired when no lock', () => {
      const conn = makeConn('c1', 'alice');
      stenoServer.onConnect(conn, makeCtx(), makeState(), 'steno');
      expect(sent(conn)).not.toContainEqual(expect.objectContaining({ type: 'stenoLockAcquired' }));
    });
  });

  describe('stenoStartRecording', () => {
    it('when unlocked: acquires lock and broadcasts stenoLockAcquired', () => {
      const conn = makeConn('c1', 'alice');
      const state = makeState();
      const ctx = makeCtx();
      const handled = stenoServer.onMessage('stenoStartRecording', { userId: 'alice' }, conn, ctx, state, 'steno');
      expect(handled).toBe(true);
      expect(state.lockUserId).toBe('alice');
      expect(JSON.parse((ctx.broadcast as ReturnType<typeof vi.fn>).mock.calls[0][0])).toEqual({ type: 'stenoLockAcquired', userId: 'alice' });
    });

    it('by the same user who holds the lock: re-acquires and broadcasts', () => {
      const conn = makeConn('c1', 'alice');
      const state = makeState();
      state.lockUserId = 'alice';
      const ctx = makeCtx();
      stenoServer.onMessage('stenoStartRecording', { userId: 'alice' }, conn, ctx, state, 'steno');
      expect(state.lockUserId).toBe('alice');
      expect(JSON.parse((ctx.broadcast as ReturnType<typeof vi.fn>).mock.calls[0][0])).toEqual({ type: 'stenoLockAcquired', userId: 'alice' });
    });

    it('when locked by another user: sends stenoLockDenied to requester, no broadcast', () => {
      const bobConn = makeConn('c-bob', 'bob');
      const state = makeState();
      state.lockUserId = 'alice';
      const ctx = makeCtx();
      stenoServer.onMessage('stenoStartRecording', { userId: 'bob' }, bobConn, ctx, state, 'steno');
      expect(ctx.broadcast).not.toHaveBeenCalled();
      expect(sent(bobConn)).toContainEqual({ type: 'stenoLockDenied', lockHolderUserId: 'alice' });
    });
  });

  describe('stenoStopRecording', () => {
    it('by the lock holder: releases lock and broadcasts stenoLockReleased', () => {
      const conn = makeConn('c1', 'alice');
      const state = makeState();
      state.lockUserId = 'alice';
      const ctx = makeCtx();
      const handled = stenoServer.onMessage('stenoStopRecording', { userId: 'alice' }, conn, ctx, state, 'steno');
      expect(handled).toBe(true);
      expect(state.lockUserId).toBeNull();
      expect(JSON.parse((ctx.broadcast as ReturnType<typeof vi.fn>).mock.calls[0][0])).toEqual({ type: 'stenoLockReleased', userId: 'alice' });
    });

    it('by a non-holder: no broadcast', () => {
      const conn = makeConn('c-bob', 'bob');
      const state = makeState();
      state.lockUserId = 'alice';
      const ctx = makeCtx();
      stenoServer.onMessage('stenoStopRecording', { userId: 'bob' }, conn, ctx, state, 'steno');
      expect(ctx.broadcast).not.toHaveBeenCalled();
    });
  });

  describe('stenoAppendText', () => {
    it('by the lock holder: appends text and broadcasts stenoTextChanged', () => {
      const conn = makeConn('c1', 'alice');
      const state = makeState();
      state.lockUserId = 'alice';
      const ctx = makeCtx();
      const handled = stenoServer.onMessage(
        'stenoAppendText',
        { userId: 'alice', text: '00:00:01.000 --> 00:00:02.000\nHello world' },
        conn, ctx, state, 'steno',
      );
      expect(handled).toBe(true);
      expect(state.vtt).toContain('Hello world');
      const msg = JSON.parse((ctx.broadcast as ReturnType<typeof vi.fn>).mock.calls[0][0]);
      expect(msg.type).toBe('stenoTextChanged');
      expect(msg.text).toContain('Hello world');
    });

    it('by a non-holder: no broadcast', () => {
      const conn = makeConn('c-bob', 'bob');
      const state = makeState();
      state.lockUserId = 'alice';
      const ctx = makeCtx();
      stenoServer.onMessage('stenoAppendText', { userId: 'bob', text: 'sneaky text' }, conn, ctx, state, 'steno');
      expect(ctx.broadcast).not.toHaveBeenCalled();
    });
  });

  describe('onClose', () => {
    it('releases lock and broadcasts stenoLockReleased when lock holder disconnects', () => {
      const state = makeState();
      state.lockUserId = 'alice';
      state.connUsers.set('c1', 'alice');
      const conn = makeConn('c1', 'alice');
      const ctx = makeCtx();
      stenoServer.onClose!(conn, ctx, state);
      expect(state.lockUserId).toBeNull();
      expect(JSON.parse((ctx.broadcast as ReturnType<typeof vi.fn>).mock.calls[0][0])).toEqual({ type: 'stenoLockReleased', userId: 'alice' });
    });

    it('keeps lock and does not broadcast when a non-holder disconnects', () => {
      const state = makeState();
      state.lockUserId = 'alice';
      state.connUsers.set('c-bob', 'bob');
      const conn = makeConn('c-bob', 'bob');
      const ctx = makeCtx();
      stenoServer.onClose!(conn, ctx, state);
      expect(state.lockUserId).toBe('alice');
      expect(ctx.broadcast).not.toHaveBeenCalled();
    });

    it('keeps lock when lock holder has another connection open', () => {
      const state = makeState();
      state.lockUserId = 'alice';
      state.connUsers.set('c1', 'alice');
      state.connUsers.set('c2', 'alice');
      const conn = makeConn('c1', 'alice');
      const ctx = makeCtx();
      stenoServer.onClose!(conn, ctx, state);
      expect(state.lockUserId).toBe('alice');
      expect(ctx.broadcast).not.toHaveBeenCalled();
    });
  });

  describe('getPersistedState / applyPersistedState', () => {
    it('persists only vtt', () => {
      const state = makeState();
      state.vtt = 'WEBVTT\ncustom';
      state.lockUserId = 'someone';
      expect(stenoServer.getPersistedState!(state)).toEqual({ vtt: 'WEBVTT\ncustom' });
    });

    it('restores vtt from persisted state', () => {
      const state = makeState();
      stenoServer.applyPersistedState!(state, { vtt: 'WEBVTT\nrestored' });
      expect(state.vtt).toBe('WEBVTT\nrestored');
    });
  });

  describe('unhandled message types', () => {
    it('returns false for unknown types', () => {
      const handled = stenoServer.onMessage('unknownEvent', {}, makeConn(), makeCtx(), makeState(), 'steno');
      expect(handled).toBe(false);
    });
  });
});
