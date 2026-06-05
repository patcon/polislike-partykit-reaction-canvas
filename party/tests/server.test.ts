import { describe, it, expect, beforeEach, vi } from 'vitest';
import type * as Party from 'partykit/server';
import Server from '../server';
import { createMockRoom, createMockConnection, makeConnectCtx } from './helpers/mockParty';

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
    connections = [];
    ({ room, broadcast } = createMockRoom(connections));
    server = new Server(room);
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
    it('move: tracks position and broadcasts to others', () => {
      const { conn } = connectUser('alice');
      server.onMessage(msg({ type: 'move', position: { userId: 'alice', x: 0.5, y: 0.3, timestamp: 1 } }), conn);
      expect(broadcast).toHaveBeenCalledOnce();
      expect(broadcast.mock.calls[0][1]).toEqual([conn.id]); // excludes sender
    });

    it('touch: tracks position and broadcasts to others', () => {
      const { conn } = connectUser('alice');
      server.onMessage(msg({ type: 'touch', position: { userId: 'alice', x: 0.2, y: 0.8, timestamp: 1 } }), conn);
      expect(broadcast).toHaveBeenCalledOnce();
      expect(broadcast.mock.calls[0][1]).toEqual([conn.id]);
    });

    it('remove: removes tracked position and broadcasts to others', () => {
      const { conn } = connectUser('alice');
      // First establish a position
      server.onMessage(msg({ type: 'move', position: { userId: 'alice', x: 0.5, y: 0.5, timestamp: 1 } }), conn);
      broadcast.mockClear();
      server.onMessage(msg({ type: 'remove', position: { userId: 'alice', x: 0, y: 0, timestamp: 2 } }), conn);
      expect(broadcast).toHaveBeenCalledOnce();
      expect(broadcast.mock.calls[0][1]).toEqual([conn.id]);
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

  describe('setLightColor', () => {
    it('broadcasts lightColor', () => {
      const { conn } = connectUser('alice');
      server.onMessage(msg({ type: 'setLightColor', color: '#ff0000', brightness: 80 }), conn);
      expect(lastBroadcast(broadcast)).toEqual({ type: 'lightColor', color: '#ff0000', brightness: 80 });
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
  // Steno locking
  // -----------------------------------------------------------------------

  describe('stenoStartRecording', () => {
    it('when unlocked: acquires lock and broadcasts stenoLockAcquired', () => {
      const { conn } = connectUser('alice');
      server.onMessage(msg({ type: 'stenoStartRecording', userId: 'alice' }), conn);
      expect(lastBroadcast(broadcast)).toEqual({ type: 'stenoLockAcquired', userId: 'alice' });
    });

    it('by the same user who already holds the lock: re-acquires and broadcasts', () => {
      const { conn } = connectUser('alice');
      server.onMessage(msg({ type: 'stenoStartRecording', userId: 'alice' }), conn);
      broadcast.mockClear();
      server.onMessage(msg({ type: 'stenoStartRecording', userId: 'alice' }), conn);
      expect(lastBroadcast(broadcast)).toEqual({ type: 'stenoLockAcquired', userId: 'alice' });
    });

    it('when locked by another user: sends stenoLockDenied to requester', () => {
      const { conn: aliceConn } = connectUser('alice');
      const { conn: bobConn, send: bobSend } = connectUser('bob');
      server.onMessage(msg({ type: 'stenoStartRecording', userId: 'alice' }), aliceConn);
      broadcast.mockClear();

      server.onMessage(msg({ type: 'stenoStartRecording', userId: 'bob' }), bobConn);

      expect(broadcast).not.toHaveBeenCalled();
      const sent = bobSend.mock.calls.map((c) => JSON.parse(c[0]));
      expect(sent).toContainEqual({ type: 'stenoLockDenied', lockHolderUserId: 'alice' });
    });
  });

  describe('stenoStopRecording', () => {
    it('by the lock holder: releases lock and broadcasts stenoLockReleased', () => {
      const { conn } = connectUser('alice');
      server.onMessage(msg({ type: 'stenoStartRecording', userId: 'alice' }), conn);
      broadcast.mockClear();

      server.onMessage(msg({ type: 'stenoStopRecording', userId: 'alice' }), conn);
      expect(lastBroadcast(broadcast)).toEqual({ type: 'stenoLockReleased', userId: 'alice' });
    });

    it('by a non-holder: no broadcast', () => {
      const { conn: aliceConn } = connectUser('alice');
      const { conn: bobConn } = connectUser('bob');
      server.onMessage(msg({ type: 'stenoStartRecording', userId: 'alice' }), aliceConn);
      broadcast.mockClear();

      server.onMessage(msg({ type: 'stenoStopRecording', userId: 'bob' }), bobConn);
      expect(broadcast).not.toHaveBeenCalled();
    });
  });

  describe('stenoAppendText', () => {
    it('by the lock holder: appends text and broadcasts stenoTextChanged', () => {
      const { conn } = connectUser('alice');
      server.onMessage(msg({ type: 'stenoStartRecording', userId: 'alice' }), conn);
      broadcast.mockClear();

      server.onMessage(msg({ type: 'stenoAppendText', userId: 'alice', text: '00:00:01.000 --> 00:00:02.000\nHello world' }), conn);
      const last = lastBroadcast(broadcast) as { type: string; text: string };
      expect(last.type).toBe('stenoTextChanged');
      expect(last.text).toContain('Hello world');
    });

    it('by a non-holder: no broadcast', () => {
      const { conn: aliceConn } = connectUser('alice');
      const { conn: bobConn } = connectUser('bob');
      server.onMessage(msg({ type: 'stenoStartRecording', userId: 'alice' }), aliceConn);
      broadcast.mockClear();

      server.onMessage(msg({ type: 'stenoAppendText', userId: 'bob', text: 'sneaky text' }), bobConn);
      expect(broadcast).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Neighbor edges
  // -----------------------------------------------------------------------

  describe('neighborEdge', () => {
    it('valid new edge: adds edge and broadcasts neighborEdgeAdded', () => {
      const { conn: aliceConn } = connectUser('alice');
      connectUser('bob');

      // Read bob's assigned neighbor code directly from server state
      const bobCode = (server as any).neighborCodes.get('bob') as string;

      server.onMessage(msg({ type: 'neighborEdge', toCode: bobCode }), aliceConn);
      const last = lastBroadcast(broadcast) as { type: string; userA: string; userB: string };
      expect(last.type).toBe('neighborEdgeAdded');
      expect([last.userA, last.userB].sort()).toEqual(['alice', 'bob']);
    });

    it('self-connection: sends neighborEdgeError with reason self', () => {
      const { conn, send } = connectUser('alice');
      const aliceCode = (server as any).neighborCodes.get('alice') as string;

      server.onMessage(msg({ type: 'neighborEdge', toCode: aliceCode }), conn);

      expect(broadcast).not.toHaveBeenCalled();
      const sent = send.mock.calls.map((c) => JSON.parse(c[0]));
      expect(sent).toContainEqual({ type: 'neighborEdgeError', reason: 'self' });
    });

    it('code not found: sends neighborEdgeError with reason not_found', () => {
      const { conn, send } = connectUser('alice');

      server.onMessage(msg({ type: 'neighborEdge', toCode: '9999' }), conn);

      expect(broadcast).not.toHaveBeenCalled();
      const sent = send.mock.calls.map((c) => JSON.parse(c[0]));
      expect(sent).toContainEqual({ type: 'neighborEdgeError', reason: 'not_found' });
    });

    it('duplicate edge: sends neighborEdgeError with reason duplicate', () => {
      const { conn: aliceConn, send: aliceSend } = connectUser('alice');
      connectUser('bob');
      const bobCode = (server as any).neighborCodes.get('bob') as string;

      server.onMessage(msg({ type: 'neighborEdge', toCode: bobCode }), aliceConn);
      broadcast.mockClear();
      aliceSend.mockClear();

      server.onMessage(msg({ type: 'neighborEdge', toCode: bobCode }), aliceConn);
      expect(broadcast).not.toHaveBeenCalled();
      const sent = aliceSend.mock.calls.map((c) => JSON.parse(c[0]));
      expect(sent).toContainEqual({ type: 'neighborEdgeError', reason: 'duplicate' });
    });
  });

  // -----------------------------------------------------------------------
  // Call queue pairing
  // -----------------------------------------------------------------------

  describe('joinCallQueue', () => {
    it('empty queue: queues user and sends callQueued', () => {
      const { conn, send } = connectUser('alice');
      server.onMessage(msg({ type: 'joinCallQueue' }), conn);
      const sent = send.mock.calls.map((c) => JSON.parse(c[0]));
      expect(sent).toContainEqual({ type: 'callQueued' });
    });

    it('another user waiting: pairs both and sends callPaired to each', () => {
      const { conn: aliceConn, send: aliceSend } = connectUser('alice');
      const { conn: bobConn, send: bobSend } = connectUser('bob');

      server.onMessage(msg({ type: 'joinCallQueue' }), aliceConn);
      server.onMessage(msg({ type: 'joinCallQueue' }), bobConn);

      const aliceMsgs = aliceSend.mock.calls.map((c) => JSON.parse(c[0]));
      const bobMsgs = bobSend.mock.calls.map((c) => JSON.parse(c[0]));

      expect(aliceMsgs).toContainEqual(expect.objectContaining({ type: 'callPaired', role: 'initiator', peerId: 'bob' }));
      expect(bobMsgs).toContainEqual(expect.objectContaining({ type: 'callPaired', role: 'receiver', peerId: 'alice' }));
    });

    it('already in a call: ignored', () => {
      const { conn: aliceConn, send: aliceSend } = connectUser('alice');
      const { conn: bobConn } = connectUser('bob');
      const { conn: carolConn } = connectUser('carol');

      server.onMessage(msg({ type: 'joinCallQueue' }), aliceConn);
      server.onMessage(msg({ type: 'joinCallQueue' }), bobConn); // pairs alice+bob
      aliceSend.mockClear();

      server.onMessage(msg({ type: 'joinCallQueue' }), aliceConn); // already paired
      expect(aliceSend).not.toHaveBeenCalled();
      void carolConn; // suppress unused warning
    });
  });

  describe('leaveCallQueue', () => {
    it('removes user from queue', () => {
      const { conn: aliceConn } = connectUser('alice');
      const { conn: bobConn, send: bobSend } = connectUser('bob');

      server.onMessage(msg({ type: 'joinCallQueue' }), aliceConn);
      server.onMessage(msg({ type: 'leaveCallQueue' }), aliceConn);

      // Bob joining now should not be immediately paired (queue was empty after alice left)
      server.onMessage(msg({ type: 'joinCallQueue' }), bobConn);
      const bobMsgs = bobSend.mock.calls.map((c) => JSON.parse(c[0]));
      expect(bobMsgs).toContainEqual({ type: 'callQueued' });
    });
  });

  // -----------------------------------------------------------------------
  // clearSignature / strokeSegment (pass-through broadcasts)
  // -----------------------------------------------------------------------

  describe('clearSignature', () => {
    it('broadcasts signatureCleared with userId', () => {
      const { conn } = connectUser('alice');
      server.onMessage(msg({ type: 'clearSignature', userId: 'alice' }), conn);
      expect(lastBroadcast(broadcast)).toEqual({ type: 'signatureCleared', userId: 'alice' });
    });
  });

  describe('strokeSegment', () => {
    it('broadcasts the raw message to all', () => {
      const { conn } = connectUser('alice');
      const rawMsg = msg({ type: 'strokeSegment', userId: 'alice', strokeId: 's1', points: [], isFinal: false });
      server.onMessage(rawMsg, conn);
      expect(broadcast).toHaveBeenCalledWith(rawMsg);
    });
  });

  // -----------------------------------------------------------------------
  // requestNeighborEdges / clearNeighborEdges
  // -----------------------------------------------------------------------

  describe('requestNeighborEdges', () => {
    it('sends neighborEdgesSnapshot with current edges and codes', () => {
      const { conn: aliceConn } = connectUser('alice');
      const { conn: bobConn, send: bobSend } = connectUser('bob');
      const bobCode = (server as any).neighborCodes.get('bob') as string;
      server.onMessage(msg({ type: 'neighborEdge', toCode: bobCode }), aliceConn);
      bobSend.mockClear();

      server.onMessage(msg({ type: 'requestNeighborEdges' }), bobConn);
      const sent = bobSend.mock.calls.map((c) => JSON.parse(c[0]));
      const snapshot = sent.find((m: any) => m.type === 'neighborEdgesSnapshot');
      expect(snapshot).toBeDefined();
      expect(snapshot.edges).toHaveLength(1);
    });
  });

  describe('clearNeighborEdges', () => {
    it('clears all edges and broadcasts neighborEdgesCleared', () => {
      const { conn: aliceConn } = connectUser('alice');
      connectUser('bob');
      const bobCode = (server as any).neighborCodes.get('bob') as string;
      server.onMessage(msg({ type: 'neighborEdge', toCode: bobCode }), aliceConn);
      broadcast.mockClear();

      server.onMessage(msg({ type: 'clearNeighborEdges' }), aliceConn);
      expect(lastBroadcast(broadcast)).toEqual({ type: 'neighborEdgesCleared' });
      expect((server as any).neighborEdges.size).toBe(0);
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
      errorSpy.mockRestore();
    });
  });
});
