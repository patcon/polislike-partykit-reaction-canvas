import { createContext, useContext } from "react";

type MessageHandler = (data: Record<string, unknown>) => void;

export interface AdminSocketContextValue {
  send(msg: Record<string, unknown>): void;
  subscribe(handler: MessageHandler): () => void;
  getLastMessage(type: string): Record<string, unknown> | undefined;
}

const noop = () => {};
const noopUnsub = () => () => {};

export const AdminSocketContext = createContext<AdminSocketContextValue>({
  send: noop,
  subscribe: noopUnsub,
  getLastMessage: () => undefined,
});

export function useAdminSocket(): AdminSocketContextValue {
  return useContext(AdminSocketContext);
}

export interface AdminSocketBus {
  value: AdminSocketContextValue;
  notify(data: Record<string, unknown>): void;
}

export function createAdminSocketBus(
  sendFn: (msg: Record<string, unknown>) => void,
): AdminSocketBus {
  const handlers = new Set<MessageHandler>();
  const cache = new Map<string, Record<string, unknown>>();

  const value: AdminSocketContextValue = {
    send: sendFn,
    subscribe(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    getLastMessage(type) {
      return cache.get(type);
    },
  };

  return {
    value,
    notify(data) {
      if (typeof data.type === 'string') cache.set(data.type, data);
      for (const h of handlers) h(data);
    },
  };
}
