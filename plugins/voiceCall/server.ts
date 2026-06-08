import type { ServerPlugin } from '../types';
import type { VoiceCallPluginState, WebRTCOfferEvent, WebRTCAnswerEvent, WebRTCIceEvent, HangUpCallEvent } from './types';

export const VoiceCallServerPlugin: ServerPlugin<VoiceCallPluginState> = {
  createState(): VoiceCallPluginState {
    return {
      callQueue: [],
      callPairs: new Map(),
      callAlgorithm: 'first-available',
    };
  },

  onConnect(conn, _ctx, state) {
    conn.send(JSON.stringify({ type: 'voiceCallState', callAlgorithm: state.callAlgorithm }));
  },

  onMessage(type, payload, conn, ctx, state): boolean {
    if (type === 'joinCallQueue') {
      const senderId = conn.userId;
      if (state.callPairs.has(senderId)) return true;
      if (state.callQueue.length > 0) {
        const waiterId = state.callQueue.shift()!;
        state.callPairs.set(waiterId, senderId);
        state.callPairs.set(senderId, waiterId);
        ctx.sendToUser(waiterId, JSON.stringify({ type: 'callPaired', role: 'initiator', peerId: senderId }));
        conn.send(JSON.stringify({ type: 'callPaired', role: 'receiver', peerId: waiterId }));
      } else {
        state.callQueue.push(senderId);
        conn.send(JSON.stringify({ type: 'callQueued' }));
      }
      return true;
    }

    if (type === 'leaveCallQueue') {
      const idx = state.callQueue.indexOf(conn.userId);
      if (idx !== -1) state.callQueue.splice(idx, 1);
      return true;
    }

    if (type === 'webrtcOffer' || type === 'webrtcAnswer' || type === 'webrtcIce') {
      const event = payload as WebRTCOfferEvent | WebRTCAnswerEvent | WebRTCIceEvent;
      ctx.sendToUser(event.targetUserId, JSON.stringify({ ...event, fromUserId: conn.userId }));
      return true;
    }

    if (type === 'hangUp') {
      const event = payload as HangUpCallEvent;
      const senderId = conn.userId;
      state.callPairs.delete(senderId);
      const peerId = event.targetUserId;
      state.callPairs.delete(peerId);
      ctx.sendToUser(peerId, JSON.stringify({ type: 'hangUp', fromUserId: senderId }));
      return true;
    }

    if (type === 'setCallAlgorithm') {
      const { algorithm } = payload as { algorithm: string };
      state.callAlgorithm = algorithm;
      ctx.broadcast(JSON.stringify({ type: 'voiceCallState', callAlgorithm: algorithm }));
      void ctx.persistState();
      return true;
    }

    return false;
  },

  onClose(conn, ctx, state) {
    const userId = conn.userId;
    const qIdx = state.callQueue.indexOf(userId);
    if (qIdx !== -1) state.callQueue.splice(qIdx, 1);
    const peerId = state.callPairs.get(userId);
    if (peerId) {
      state.callPairs.delete(userId);
      state.callPairs.delete(peerId);
      ctx.sendToUser(peerId, JSON.stringify({ type: 'hangUp', fromUserId: userId }));
    }
  },

  onActivate() {},
  onDeactivate() {},

  getPersistedState(state) {
    return { callAlgorithm: state.callAlgorithm };
  },

  applyPersistedState(state, saved) {
    const s = saved as { callAlgorithm?: string } | null;
    if (s?.callAlgorithm) state.callAlgorithm = s.callAlgorithm;
  },
};
