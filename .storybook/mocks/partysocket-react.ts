// Storybook mock for partysocket/react.
// Prevents components from attempting real WebSocket connections during story rendering.
export default function usePartySocket(_options: any) {
  return {
    send: () => {},
    close: () => {},
    reconnect: () => {},
    readyState: 3, // WebSocket.CLOSED
  };
}
