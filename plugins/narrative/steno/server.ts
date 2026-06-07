import type { ServerPlugin } from '../../types';
import type { StenoState } from '../types';

export const stenoServer: ServerPlugin<StenoState> = {
  createState: () => ({ vtt: 'WEBVTT\n', lockUserId: null, connUsers: new Map() }),

  onConnect(conn, _ctx, state) {
    state.connUsers.set(conn.id, conn.userId);
    conn.send(JSON.stringify({ type: 'stenoTextChanged', text: state.vtt }));
    if (state.lockUserId !== null) {
      conn.send(JSON.stringify({ type: 'stenoLockAcquired', userId: state.lockUserId }));
    }
  },

  onMessage(type, payload, conn, ctx, state) {
    const event = payload as Record<string, unknown>;
    switch (type) {
      case 'stenoStartRecording': {
        if (state.lockUserId !== null && state.lockUserId !== event.userId) {
          conn.send(JSON.stringify({ type: 'stenoLockDenied', lockHolderUserId: state.lockUserId }));
          return true;
        }
        state.lockUserId = event.userId as string;
        ctx.broadcast(JSON.stringify({ type: 'stenoLockAcquired', userId: state.lockUserId }));
        return true;
      }
      case 'stenoStopRecording': {
        if (state.lockUserId !== event.userId) return true;
        state.lockUserId = null;
        ctx.broadcast(JSON.stringify({ type: 'stenoLockReleased', userId: event.userId }));
        return true;
      }
      case 'stenoAppendText': {
        if (state.lockUserId !== event.userId) return true;
        state.vtt += '\n' + (event.text as string) + '\n';
        ctx.broadcast(JSON.stringify({ type: 'stenoTextChanged', text: state.vtt }));
        void ctx.persistState();
        return true;
      }
      case 'stenoSetText': {
        if (state.lockUserId !== null && state.lockUserId !== event.userId) return true;
        state.vtt = event.text as string;
        ctx.broadcast(JSON.stringify({ type: 'stenoTextChanged', text: state.vtt }));
        void ctx.persistState();
        return true;
      }
      default:
        return false;
    }
  },

  onClose(conn, ctx, state) {
    state.connUsers.delete(conn.id);
    const userStillConnected = [...state.connUsers.values()].some(uid => uid === conn.userId);
    if (!userStillConnected && state.lockUserId === conn.userId) {
      state.lockUserId = null;
      ctx.broadcast(JSON.stringify({ type: 'stenoLockReleased', userId: conn.userId }));
    }
  },

  onActivate() {},
  onDeactivate() {},

  getPersistedState(state) {
    return { vtt: state.vtt };
  },

  applyPersistedState(state, saved: unknown) {
    const s = saved as { vtt?: string };
    if (s.vtt !== undefined) state.vtt = s.vtt;
  },
};
