import { describe, it, expect, vi, beforeEach } from 'vitest';
import Server from './server';
import type * as Party from 'partykit/server';

function makeConn(id: string): Party.Connection {
  return { id, send: vi.fn(), close: vi.fn(), socket: null as never, url: '' } as unknown as Party.Connection;
}

function makeCtx(url: string): Party.ConnectionContext {
  return { request: { url } as unknown as Request } as unknown as Party.ConnectionContext;
}

function makeRoom(connections: Party.Connection[]): Party.Room {
  return {
    id: 'test-room',
    getConnections: () => connections as unknown as IterableIterator<Party.Connection>,
    broadcast: vi.fn(),
    storage: { get: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined), delete: vi.fn(), list: vi.fn() } as never,
    env: { DISABLE_STORAGE_PERSISTENCE: 'true', DEBUG: 'false' },
    name: 'test-room',
    parties: {} as never,
    context: {} as never,
    internalID: 'test-room',
    connections: [] as never,
    sendMessage: vi.fn(),
  } as unknown as Party.Room;
}

function sent(conn: Party.Connection): unknown[] {
  return (conn.send as ReturnType<typeof vi.fn>).mock.calls.map((c: string[]) => JSON.parse(c[0]));
}

function sentTypes(conn: Party.Connection): string[] {
  return sent(conn).map((m: any) => m.type);
}

// Establish a participant connection on the server.
function connectParticipant(server: Server, conn: Party.Connection, userId: string) {
  server.onConnect(conn, makeCtx(`https://localhost/?userId=${userId}`));
}

// Establish an admin (emcee) connection on the server.
function connectAdmin(server: Server, conn: Party.Connection, userId: string) {
  server.onConnect(conn, makeCtx(`https://localhost/?userId=${userId}&isAdmin=true`));
}

describe('pushInterface routing', () => {
  let connections: Party.Connection[];
  let server: Server;

  beforeEach(() => {
    connections = [];
    const room = makeRoom(connections);
    server = new Server(room);
  });

  function addConn(id: string): Party.Connection {
    const conn = makeConn(id);
    connections.push(conn);
    return conn;
  }

  it('delivers to a targeted participant by userId', () => {
    const aliceConn = addConn('c-alice');
    const bobConn = addConn('c-bob');
    const adminConn = addConn('c-admin');

    connectParticipant(server, aliceConn, 'alice');
    connectParticipant(server, bobConn, 'bob');
    connectAdmin(server, adminConn, 'emcee');

    server.onMessage(JSON.stringify({ type: 'pushInterface', targetUserId: 'alice', interfaceName: 'social-sharing' }), adminConn);

    expect(sentTypes(aliceConn)).toContain('interfacePushed');
    expect(sentTypes(bobConn)).not.toContain('interfacePushed');
    expect(sentTypes(adminConn)).not.toContain('interfacePushed');
  });

  it('delivers to the emcee when they target their own userId', () => {
    const adminConn = addConn('c-admin');
    const participantConn = addConn('c-participant');

    connectAdmin(server, adminConn, 'emcee');
    connectParticipant(server, participantConn, 'participant');

    server.onMessage(JSON.stringify({ type: 'pushInterface', targetUserId: 'emcee', interfaceName: 'social-sharing' }), adminConn);

    expect(sentTypes(adminConn)).toContain('interfacePushed');
    expect(sentTypes(participantConn)).not.toContain('interfacePushed');
  });

  it('delivers to multiple targets by userIds, including the emcee themselves', () => {
    const adminConn = addConn('c-admin');
    const aliceConn = addConn('c-alice');
    const bobConn = addConn('c-bob');

    connectAdmin(server, adminConn, 'emcee');
    connectParticipant(server, aliceConn, 'alice');
    connectParticipant(server, bobConn, 'bob');

    server.onMessage(JSON.stringify({ type: 'pushInterface', targetUserIds: ['emcee', 'alice'], interfaceName: 'social-sharing' }), adminConn);

    expect(sentTypes(adminConn)).toContain('interfacePushed');
    expect(sentTypes(aliceConn)).toContain('interfacePushed');
    expect(sentTypes(bobConn)).not.toContain('interfacePushed');
  });

  it('is ignored when sent by a non-admin connection', () => {
    const participantConn = addConn('c-participant');
    const targetConn = addConn('c-target');

    connectParticipant(server, participantConn, 'participant');
    connectParticipant(server, targetConn, 'target');

    server.onMessage(JSON.stringify({ type: 'pushInterface', targetUserId: 'target', interfaceName: 'social-sharing' }), participantConn);

    expect(sentTypes(targetConn)).not.toContain('interfacePushed');
  });
});
