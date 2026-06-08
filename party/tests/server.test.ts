import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type * as Party from 'partykit/server';
import Server from '../server';
import { createMockRoom, createMockConnection, makeConnectCtx } from './helpers/mockParty';

// Mutable mock so individual describe blocks can test both batching modes.
const cursorMock = vi.hoisted(() => ({ SERVER_CURSOR_BATCH_MS: 50 }));
vi.mock('../../app/utils/cursor', () => cursorMock);

// Helper: JSON-encode a client event for onMessage
function msg(event: object): string {
  return JSON.stringify(event);
}

// Helper: parse the first matching broadcast call
function lastBroadcast(broadcast: ReturnType<typeof vi.fn>): unknown {
  const calls = broadcast.mock.calls;
  if (calls.length === 0) return undefined;
  return JSON.parse(calls[calls.length - 1][0] as string);
}

function allBroadcasts(broadcast: ReturnType<typeof vi.fn>): unknown[] {
  return broadcast.mock.calls.map(([m]) => JSON.parse(m as string));
}

describe('Server onMessage handlers', () => {
  let connections: Party.Connection[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let broadcast: ReturnType<typeof vi.fn<any>>;
  let room: Party.Room;
  let server: Server;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    connections = [];
    ({ room, broadcast } = createMockRoom(connections));
    server = new Server(room);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function connectUser(userId: string, opts: { isAdmin?: boolean } = {}) {
    const { conn, send } = createMockConnection(`conn-${userId}`);
    connections.push(conn);
    server.onConnect(conn, makeConnectCtx(userId, opts));
    broadcast.mockClear();
    send.mockClear();
    return { conn, send };
  }

  // -----------------------------------------------------------------------
  // Cursor events
  // -----------------------------------------------------------------------

  describe('cursor: move / touch / remove', () => {
    describe('batching disabled (SERVER_CURSOR_BATCH_MS = 0)', () => {
      beforeEach(() => { cursorMock.SERVER_CURSOR_BATCH_MS = 0; });
      afterEach(() => { cursorMock.SERVER_CURSOR_BATCH_MS = 50; });

      it('move: tracks position and broadcasts immediately to others', () => {
        const { conn } = connectUser('alice');
        server.onMessage(msg({ type: 'move', position: { userId: 'alice', x: 0.5, y: 0.3, timestamp: 1 } }), conn);
        expect(broadcast).toHaveBeenCalledOnce();
        expect(broadcast.mock.calls[0][1]).toEqual([conn.id]); // excludes sender
        const payload = JSON.parse(broadcast.mock.calls[0][0] as string);
        expect(payload.type).toBe('move');
      });

      it('touch: tracks position and broadcasts immediately to others', () => {
        const { conn } = connectUser('alice');
        server.onMessage(msg({ type: 'touch', position: { userId: 'alice', x: 0.2, y: 0.8, timestamp: 1 } }), conn);
        expect(broadcast).toHaveBeenCalledOnce();
        expect(broadcast.mock.calls[0][1]).toEqual([conn.id]);
        const payload = JSON.parse(broadcast.mock.calls[0][0] as string);
        expect(payload.type).toBe('touch');
      });

      it('remove: removes tracked position and broadcasts immediately to others', () => {
        const { conn } = connectUser('alice');
        server.onMessage(msg({ type: 'move', position: { userId: 'alice', x: 0.5, y: 0.5, timestamp: 1 } }), conn);
        broadcast.mockClear();
        server.onMessage(msg({ type: 'remove', position: { userId: 'alice', x: 0, y: 0, timestamp: 2 } }), conn);
        expect(broadcast).toHaveBeenCalledOnce();
        expect(broadcast.mock.calls[0][1]).toEqual([conn.id]);
        const payload = JSON.parse(broadcast.mock.calls[0][0] as string);
        expect(payload.type).toBe('remove');
      });
    });

    describe('batching enabled (SERVER_CURSOR_BATCH_MS = 50)', () => {
      beforeEach(() => { cursorMock.SERVER_CURSOR_BATCH_MS = 50; vi.useFakeTimers(); });
      afterEach(() => { vi.useRealTimers(); });

      it('move: not broadcast until timer fires, then cursorBatch to all', () => {
        const { conn } = connectUser('alice');
        server.onMessage(msg({ type: 'move', position: { userId: 'alice', x: 0.5, y: 0.3, timestamp: 1 } }), conn);
        expect(broadcast).not.toHaveBeenCalled();
        vi.advanceTimersByTime(50);
        expect(broadcast).toHaveBeenCalledOnce();
        const payload = JSON.parse(broadcast.mock.calls[0][0] as string);
        expect(payload.type).toBe('cursorBatch');
        expect(payload.cursors[0]).toMatchObject({ type: 'move', position: { userId: 'alice' } });
      });

      it('touch: not broadcast until timer fires, then cursorBatch to all', () => {
        const { conn } = connectUser('alice');
        server.onMessage(msg({ type: 'touch', position: { userId: 'alice', x: 0.2, y: 0.8, timestamp: 1 } }), conn);
        expect(broadcast).not.toHaveBeenCalled();
        vi.advanceTimersByTime(50);
        expect(broadcast).toHaveBeenCalledOnce();
        const payload = JSON.parse(broadcast.mock.calls[0][0] as string);
        expect(payload.type).toBe('cursorBatch');
        expect(payload.cursors[0]).toMatchObject({ type: 'touch', position: { userId: 'alice' } });
      });

      it('remove: not broadcast until timer fires, then cursorBatch to all', () => {
        const { conn } = connectUser('alice');
        server.onMessage(msg({ type: 'move', position: { userId: 'alice', x: 0.5, y: 0.5, timestamp: 1 } }), conn);
        vi.advanceTimersByTime(50);
        broadcast.mockClear();
        server.onMessage(msg({ type: 'remove', position: { userId: 'alice', x: 0, y: 0, timestamp: 2 } }), conn);
        expect(broadcast).not.toHaveBeenCalled();
        vi.advanceTimersByTime(50);
        expect(broadcast).toHaveBeenCalledOnce();
        const payload = JSON.parse(broadcast.mock.calls[0][0] as string);
        expect(payload.type).toBe('cursorBatch');
        expect(payload.cursors[0]).toMatchObject({ type: 'remove', position: { userId: 'alice' } });
      });

      it('coalesces rapid moves from the same user into one cursor entry', () => {
        const { conn } = connectUser('alice');
        server.onMessage(msg({ type: 'move', position: { userId: 'alice', x: 0.1, y: 0.1, timestamp: 1 } }), conn);
        server.onMessage(msg({ type: 'move', position: { userId: 'alice', x: 0.9, y: 0.9, timestamp: 2 } }), conn);
        vi.advanceTimersByTime(50);
        expect(broadcast).toHaveBeenCalledOnce();
        const payload = JSON.parse(broadcast.mock.calls[0][0] as string);
        expect(payload.cursors).toHaveLength(1); // coalesced
        expect(payload.cursors[0].position).toMatchObject({ x: 0.9, y: 0.9 }); // latest wins
      });
    });
  });

  // -----------------------------------------------------------------------
  // Room config
  // -----------------------------------------------------------------------

  describe('setRoomLabels', () => {
    it('updates labels and broadcasts roomLabelsChanged', () => {
      const { conn } = connectUser('alice');
      const labels = { positive: 'Yes', negative: 'No', neutral: 'Skip' };
      server.onMessage(msg({ type: 'setRoomLabels', labels }), conn);
      expect(lastBroadcast(broadcast)).toMatchObject({ type: 'roomLabelsChanged', labels });
    });
  });

  describe('setTimecode', () => {
    it('updates timecode and broadcasts timecodeUpdate', () => {
      const { conn } = connectUser('alice');
      server.onMessage(msg({ type: 'setTimecode', timecode: 42000 }), conn);
      expect(lastBroadcast(broadcast)).toEqual({ type: 'timecodeUpdate', timecode: 42000 });
    });
  });

  describe('setRecordingState', () => {
    it('broadcasts recordingStateChanged', () => {
      const { conn } = connectUser('alice');
      server.onMessage(msg({ type: 'setRecordingState', recording: true }), conn);
      expect(lastBroadcast(broadcast)).toEqual({ type: 'recordingStateChanged', recording: true });
    });
  });

  describe('setNowLabel', () => {
    it('broadcasts nowLabelChanged', () => {
      const { conn } = connectUser('alice');
      server.onMessage(msg({ type: 'setNowLabel', label: 'Q&A' }), conn);
      expect(lastBroadcast(broadcast)).toEqual({ type: 'nowLabelChanged', label: 'Q&A' });
    });
  });

  describe('setImageUrl', () => {
    it('broadcasts imageUrlChanged', () => {
      const { conn } = connectUser('alice');
      server.onMessage(msg({ type: 'setImageUrl', url: 'https://example.com/img.png' }), conn);
      expect(lastBroadcast(broadcast)).toEqual({ type: 'imageUrlChanged', url: 'https://example.com/img.png' });
    });
  });

  // -----------------------------------------------------------------------
  // Admin guards
  // -----------------------------------------------------------------------

  describe('setUserCap', () => {
    it('from admin: updates cap and broadcasts userCapChanged', () => {
      const { conn } = connectUser('admin', { isAdmin: true });
      server.onMessage(msg({ type: 'setUserCap', cap: 10 }), conn);
      expect(lastBroadcast(broadcast)).toEqual({ type: 'userCapChanged', cap: 10 });
    });

    it('from non-admin: no broadcast', () => {
      const { conn } = connectUser('alice');
      server.onMessage(msg({ type: 'setUserCap', cap: 10 }), conn);
      expect(broadcast).not.toHaveBeenCalled();
    });
  });

  describe('setOwnValenceDisplay', () => {
    it('from admin: broadcasts ownValenceDisplayChanged', () => {
      const { conn } = connectUser('admin', { isAdmin: true });
      server.onMessage(msg({ type: 'setOwnValenceDisplay', mode: 'background' }), conn);
      expect(lastBroadcast(broadcast)).toMatchObject({ type: 'ownValenceDisplayChanged', ownValenceDisplay: 'background' });
    });

    it('from non-admin: no broadcast', () => {
      const { conn } = connectUser('alice');
      server.onMessage(msg({ type: 'setOwnValenceDisplay', mode: 'background' }), conn);
      expect(broadcast).not.toHaveBeenCalled();
    });
  });

  describe('clearPushedInterfaces', () => {
    it('from admin: broadcasts pushedInterfacesCleared', () => {
      const { conn } = connectUser('admin', { isAdmin: true });
      server.onMessage(msg({ type: 'clearPushedInterfaces' }), conn);
      expect(lastBroadcast(broadcast)).toEqual({ type: 'pushedInterfacesCleared' });
    });

    it('from non-admin: no broadcast', () => {
      const { conn } = connectUser('alice');
      server.onMessage(msg({ type: 'clearPushedInterfaces' }), conn);
      expect(broadcast).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // requestJoin (viewer promotion)
  // -----------------------------------------------------------------------

  describe('requestJoin', () => {
    it('viewer under cap: removes from viewers and sends joinApproved', () => {
      // Create a viewer: fill the room at cap=1, then the next connection is a viewer.
      // Then admin raises cap to 2, which opens a slot so requestJoin succeeds.
      const { conn: adminConn } = connectUser('admin', { isAdmin: true });
      server.onMessage(msg({ type: 'setUserCap', cap: 1 }), adminConn);

      connectUser('participant1'); // fills the cap

      const { conn: viewerConn, send: viewerSend } = createMockConnection('conn-viewer');
      connections.push(viewerConn);
      server.onConnect(viewerConn, makeConnectCtx('viewer1')); // isViewer=true (cap full)

      // Admin raises cap to open a slot
      server.onMessage(msg({ type: 'setUserCap', cap: 2 }), adminConn);
      broadcast.mockClear();
      viewerSend.mockClear();

      server.onMessage(msg({ type: 'requestJoin' }), viewerConn);

      const sentMessages = viewerSend.mock.calls.map((c) => JSON.parse(c[0]));
      expect(sentMessages).toContainEqual({ type: 'joinApproved' });
    });

    it('viewer when cap is full: sends joinDenied', () => {
      const { conn: adminConn } = connectUser('admin', { isAdmin: true });
      server.onMessage(msg({ type: 'setUserCap', cap: 1 }), adminConn);

      connectUser('participant1');

      // Connect two viewers beyond the cap
      const { conn: viewer1Conn } = createMockConnection('conn-viewer1');
      connections.push(viewer1Conn);
      server.onConnect(viewer1Conn, makeConnectCtx('viewer1'));

      const { conn: viewer2Conn, send: viewer2Send } = createMockConnection('conn-viewer2');
      connections.push(viewer2Conn);
      server.onConnect(viewer2Conn, makeConnectCtx('viewer2'));
      broadcast.mockClear();
      viewer2Send.mockClear();

      // viewer1 joins first, filling the slot
      server.onMessage(msg({ type: 'requestJoin' }), viewer1Conn);

      // viewer2 tries to join but cap is now full
      server.onMessage(msg({ type: 'requestJoin' }), viewer2Conn);

      const sentMessages = viewer2Send.mock.calls.map((c) => JSON.parse(c[0]));
      expect(sentMessages).toContainEqual({ type: 'joinDenied' });
    });

    it('non-viewer: no-op (no send)', () => {
      const { conn, send } = connectUser('alice');
      server.onMessage(msg({ type: 'requestJoin' }), conn);
      expect(send).not.toHaveBeenCalled();
      expect(broadcast).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Malformed message
  // -----------------------------------------------------------------------

  describe('malformed message', () => {
    it('does not throw and does not broadcast', () => {
      const { conn } = connectUser('alice');
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => server.onMessage('not json', conn)).not.toThrow();
      expect(errorSpy).toHaveBeenCalledWith('Failed to parse event:', expect.any(SyntaxError));
      expect(broadcast).not.toHaveBeenCalled();
    });
  });
});
