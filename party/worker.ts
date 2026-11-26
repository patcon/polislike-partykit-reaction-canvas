/**
 * Cloudflare Worker entry point (cloudflare/partykit `partyserver`).
 *
 * Each party is a Durable Object class. `routePartykitRequest` maps
 * /parties/:party/:room to the DO binding whose kebab-cased name matches :party,
 * so binding `Main` serves /parties/main/* and `Perf` serves /parties/perf/*.
 * Everything else falls through to Workers static assets (the SPA in public/).
 *
 * The DO classes here are thin adapters: room logic lives in server.ts /
 * perf-server.ts against the runtime-agnostic `Room` interface (room.ts), so it
 * stays unit-testable in node without the workerd runtime.
 */
import {
  Server as PartyServer,
  routePartykitRequest,
  type Connection,
  type ConnectionContext,
  type WSMessage,
} from "partyserver";
import RoomServer from "./server";
import PerfServer from "./perf-server";
import type { Room } from "./room";

export interface Env {
  ASSETS: Fetcher;
  Main: DurableObjectNamespace;
  Perf: DurableObjectNamespace;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  DISABLE_STORAGE_PERSISTENCE?: string;
  DEBUG?: string;
}

function asText(message: WSMessage): string {
  return typeof message === "string" ? message : new TextDecoder().decode(message);
}

/** A partyserver Durable Object that exposes itself as the runtime-agnostic `Room`. */
abstract class RoomAdapter extends PartyServer<Env> {
  protected room: Room = this.asRoom();

  private asRoom(): Room {
    const server = this;
    return {
      get id() { return server.name; },
      get env() { return server.env as unknown as Record<string, unknown>; },
      get storage() { return server.ctx.storage; },
      broadcast: (msg, without) => server.broadcast(msg, without),
      getConnections: () => server.getConnections(),
      getConnection: (id) => server.getConnection(id),
    };
  }
}

export class Main extends RoomAdapter {
  private logic: RoomServer = new RoomServer(this.room);

  onStart(): Promise<void> { return this.logic.onStart(); }
  onConnect(conn: Connection, ctx: ConnectionContext): void { this.logic.onConnect(conn, ctx); }
  // partyserver passes (connection, message); the room logic keeps the legacy (message, sender) order.
  onMessage(conn: Connection, message: WSMessage): void { this.logic.onMessage(asText(message), conn); }
  onClose(conn: Connection): void { this.logic.onClose(conn); }
  onRequest(request: Request): Promise<Response> { return this.logic.onRequest(request); }
}

export class Perf extends RoomAdapter {
  private logic: PerfServer = new PerfServer(this.room);

  onConnect(conn: Connection, ctx: ConnectionContext): void { this.logic.onConnect(conn, ctx); }
  onMessage(conn: Connection, message: WSMessage): void { this.logic.onMessage(asText(message), conn); }
  onClose(conn: Connection): void { this.logic.onClose(conn); }
}

export default {
  async fetch(request, env) {
    return (await routePartykitRequest(request, env)) ?? env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
