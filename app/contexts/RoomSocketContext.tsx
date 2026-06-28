import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import usePartySocket from "partysocket/react";
import { getPartySocketConfig } from "../utils/partyHost";

interface RoomSocketContextValue {
  send: (msg: string) => void;
  subscribe: (cb: (evt: MessageEvent) => void) => void;
  unsubscribe: (cb: (evt: MessageEvent) => void) => void;
}

const RoomSocketContext = createContext<RoomSocketContextValue | null>(null);

interface RoomSocketProviderProps {
  room: string;
  userId: string;
  party?: string;
  readOnly?: boolean;
  children: React.ReactNode;
}

export function RoomSocketProvider({ room, userId, party = "main", readOnly = false, children }: RoomSocketProviderProps) {
  const subscribersRef = useRef(new Set<(evt: MessageEvent) => void>());

  const subscribe = useCallback((cb: (evt: MessageEvent) => void) => {
    subscribersRef.current.add(cb);
  }, []);

  const unsubscribe = useCallback((cb: (evt: MessageEvent) => void) => {
    subscribersRef.current.delete(cb);
  }, []);

  const socket = usePartySocket({
    ...getPartySocketConfig(),
    party,
    room,
    query: readOnly ? { isAdmin: "true" } : { userId },
    onMessage(evt) {
      subscribersRef.current.forEach(cb => cb(evt));
    },
  });

  const send = useCallback((msg: string) => socket.send(msg), [socket]);

  const value = useMemo(() => ({ send, subscribe, unsubscribe }), [send, subscribe, unsubscribe]);

  return (
    <RoomSocketContext.Provider value={value}>
      {children}
    </RoomSocketContext.Provider>
  );
}

export function useRoomSocket(): RoomSocketContextValue {
  const ctx = useContext(RoomSocketContext);
  if (!ctx) throw new Error("useRoomSocket must be used inside RoomSocketProvider");
  return ctx;
}

export function useMessageSubscription(callback: (evt: MessageEvent) => void): void {
  const { subscribe, unsubscribe } = useRoomSocket();
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const handler = (evt: MessageEvent) => callbackRef.current(evt);
    subscribe(handler);
    return () => unsubscribe(handler);
  }, [subscribe, unsubscribe]);
}
