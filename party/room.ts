/**
 * Runtime-agnostic room types used by the room logic in server.ts / perf-server.ts.
 *
 * The logic classes depend only on these structural types, not on `partyserver`
 * (which imports `cloudflare:workers` and can't load in node tests). The Durable
 * Object adapter in worker.ts maps a partyserver `Server` onto `Room`.
 *
 * Shapes mirror the legacy `partykit/server` API so call sites read the same.
 */

export type Request = globalThis.Request;

export interface Connection {
  readonly id: string;
  send(message: string): void;
}

export interface ConnectionContext {
  readonly request: Request;
}

export interface Storage {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
}

export interface Room {
  /** Room name, e.g. "default" in /parties/main/default. */
  readonly id: string;
  readonly env: Record<string, unknown>;
  readonly storage: Storage;
  broadcast(message: string, without?: string[]): void;
  getConnections(): Iterable<Connection>;
  getConnection(id: string): Connection | undefined;
}
