import { describe, it, expect, vi } from 'vitest';
import { VoiceCallServerPlugin } from './server';
import { makeCtx, makeConn } from '../testHelpers';

function makeState() {
  return VoiceCallServerPlugin.createState();
}

describe('VoiceCallServerPlugin', () => {
  describe('onConnect', () => {
    it('sends voiceCallState with current algorithm', () => {
      const conn = makeConn();
      const state = makeState();
      VoiceCallServerPlugin.onConnect(conn, makeCtx(), state, 'voice-call');
      const sent = JSON.parse((conn.send as ReturnType<typeof vi.fn>).mock.calls[0][0]);
      expect(sent).toEqual({ type: 'voiceCallState', callAlgorithm: 'first-available' });
    });
  });

  describe('joinCallQueue — FIFO pairing', () => {
    it('first user enters the queue and receives callQueued', () => {
      const conn = makeConn('c1', 'user-1');
      const state = makeState();
      const handled = VoiceCallServerPlugin.onMessage('joinCallQueue', {}, conn, makeCtx(), state, 'voice-call');
      expect(handled).toBe(true);
      expect(state.callQueue).toEqual(['user-1']);
      const sent = JSON.parse((conn.send as ReturnType<typeof vi.fn>).mock.calls[0][0]);
      expect(sent).toEqual({ type: 'callQueued' });
    });

    it('second user pairs with the first immediately', () => {
      const conn1 = makeConn('c1', 'user-1');
      const conn2 = makeConn('c2', 'user-2');
      const state = makeState();
      const ctx = makeCtx();

      VoiceCallServerPlugin.onMessage('joinCallQueue', {}, conn1, ctx, state, 'voice-call');
      VoiceCallServerPlugin.onMessage('joinCallQueue', {}, conn2, ctx, state, 'voice-call');

      expect(state.callQueue).toHaveLength(0);
      expect(state.callPairs.get('user-1')).toBe('user-2');
      expect(state.callPairs.get('user-2')).toBe('user-1');

      const sendToUser = ctx.sendToUser as ReturnType<typeof vi.fn>;
      const initiatorMsg = JSON.parse(sendToUser.mock.calls[0][1]);
      expect(sendToUser.mock.calls[0][0]).toBe('user-1');
      expect(initiatorMsg).toEqual({ type: 'callPaired', role: 'initiator', peerId: 'user-2' });

      const receiverMsg = JSON.parse((conn2.send as ReturnType<typeof vi.fn>).mock.calls[0][0]);
      expect(receiverMsg).toEqual({ type: 'callPaired', role: 'receiver', peerId: 'user-1' });
    });

    it('ignores join when user is already in a call', () => {
      const conn = makeConn('c1', 'user-1');
      const state = makeState();
      state.callPairs.set('user-1', 'user-2');
      VoiceCallServerPlugin.onMessage('joinCallQueue', {}, conn, makeCtx(), state, 'voice-call');
      expect(state.callQueue).toHaveLength(0);
    });
  });

  describe('leaveCallQueue', () => {
    it('removes user from queue', () => {
      const conn = makeConn('c1', 'user-1');
      const state = makeState();
      state.callQueue.push('user-1');
      VoiceCallServerPlugin.onMessage('leaveCallQueue', {}, conn, makeCtx(), state, 'voice-call');
      expect(state.callQueue).toHaveLength(0);
    });
  });

  describe('onClose — disconnect cleanup', () => {
    it('removes user from queue on disconnect', () => {
      const conn = makeConn('c1', 'user-1');
      const state = makeState();
      state.callQueue.push('user-1');
      VoiceCallServerPlugin.onClose!(conn, makeCtx(), state);
      expect(state.callQueue).toHaveLength(0);
    });

    it('notifies paired peer and removes both pairs on disconnect', () => {
      const conn = makeConn('c1', 'user-1');
      const state = makeState();
      state.callPairs.set('user-1', 'user-2');
      state.callPairs.set('user-2', 'user-1');
      const ctx = makeCtx();
      VoiceCallServerPlugin.onClose!(conn, ctx, state);
      expect(state.callPairs.has('user-1')).toBe(false);
      expect(state.callPairs.has('user-2')).toBe(false);
      const sendToUser = ctx.sendToUser as ReturnType<typeof vi.fn>;
      expect(sendToUser.mock.calls[0][0]).toBe('user-2');
      expect(JSON.parse(sendToUser.mock.calls[0][1])).toEqual({ type: 'hangUp', fromUserId: 'user-1' });
    });
  });

  describe('setCallAlgorithm', () => {
    it('updates algorithm, broadcasts voiceCallState, persists', () => {
      const conn = makeConn();
      const state = makeState();
      const ctx = makeCtx();
      const handled = VoiceCallServerPlugin.onMessage('setCallAlgorithm', { algorithm: 'some-future-algo' }, conn, ctx, state, 'voice-call');
      expect(handled).toBe(true);
      expect(state.callAlgorithm).toBe('some-future-algo');
      const broadcast = ctx.broadcast as ReturnType<typeof vi.fn>;
      expect(JSON.parse(broadcast.mock.calls[0][0])).toEqual({ type: 'voiceCallState', callAlgorithm: 'some-future-algo' });
      expect(ctx.persistState).toHaveBeenCalledOnce();
    });
  });

  describe('persisted state', () => {
    it('getPersistedState returns only callAlgorithm', () => {
      const state = makeState();
      state.callAlgorithm = 'custom';
      state.callQueue.push('user-x');
      expect(VoiceCallServerPlugin.getPersistedState!(state)).toEqual({ callAlgorithm: 'custom' });
    });

    it('applyPersistedState restores callAlgorithm', () => {
      const state = makeState();
      VoiceCallServerPlugin.applyPersistedState!(state, { callAlgorithm: 'restored' });
      expect(state.callAlgorithm).toBe('restored');
    });
  });

  describe('unhandled message types', () => {
    it('returns false for unknown types', () => {
      const handled = VoiceCallServerPlugin.onMessage('move', {}, makeConn(), makeCtx(), makeState(), 'canvas');
      expect(handled).toBe(false);
    });
  });
});
