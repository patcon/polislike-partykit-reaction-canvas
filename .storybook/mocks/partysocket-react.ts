// Storybook mock for partysocket/react.
// Prevents components from attempting real WebSocket connections during story rendering,
// while allowing stories to push fake messages via emitToRoom.
import { useEffect } from 'react';
import { subscribe, unsubscribe, emitToRoom } from './socketMessageBus';

export { emitToRoom };

export default function usePartySocket({ room, onMessage, onOpen, onClose }: any) {
  useEffect(() => {
    onOpen?.();
    if (!onMessage) return;
    subscribe(room, onMessage);
    return () => {
      unsubscribe(room, onMessage);
      onClose?.();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  return {
    send: () => {},
    close: () => {},
    reconnect: () => {},
    readyState: 1, // WebSocket.OPEN — components expecting a live connection behave correctly
  };
}
