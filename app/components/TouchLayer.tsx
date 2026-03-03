import { useRef, useEffect, useState } from "react";
import usePartySocket from "partysocket/react";
import { computeReactionRegion, DEFAULT_ANCHORS } from "../utils/voteRegion";
import type { ReactionAnchors } from "../utils/voteRegion";

interface CursorPosition {
  x: number; // Normalized coordinates (0-100)
  y: number; // Normalized coordinates (0-100)
  timestamp: number;
  userId: string;
}

interface CursorEvent {
  type: 'move' | 'touch' | 'remove';
  position: CursorPosition;
}

interface ServerMessage {
  type: 'connected' | 'activeStatementChanged';
  connectionId?: string;
  activeStatementId?: number;
  statementId?: number;
}

type ReactionState = 'positive' | 'negative' | 'neutral' | null;

interface TouchLayerProps {
  room: string;
  onActiveStatementChange: (statementId: number) => void;
  onReactionStateChange: (reactionState: ReactionState) => void;
  userId: string;
  reactionStateRef?: React.MutableRefObject<ReactionState>;
  onBackgroundColorChange: (reactionState: ReactionState) => void;
  heightOffset?: number; // Pixels to subtract from window.innerHeight (default: statement panel height)
  onTouchPosition?: (pos: { x: number; y: number } | null) => void; // Pixel coords relative to layer
  getTimecode?: () => number; // Returns current video timecode to send on lift
  anchors?: ReactionAnchors;
  onCursorEvent?: (type: 'move' | 'touch' | 'remove', pos: { x: number; y: number }) => void;
}

export default function TouchLayer({
  room,
  onActiveStatementChange,
  onReactionStateChange,
  userId,
  reactionStateRef,
  onBackgroundColorChange,
  heightOffset,
  onTouchPosition,
  getTimecode,
  anchors,
  onCursorEvent,
}: TouchLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const [userReactionState, setUserReactionState] = useState<ReactionState>(null);
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight - (heightOffset ?? 140)
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isMouseOver, setIsMouseOver] = useState(false);
  const lastTouchTimeRef = useRef(0); // Used to suppress synthesized mouse events after touch
  const currentReactionStateRef = useRef<ReactionState>(null);
  const lastPositionRef = useRef<CursorPosition | null>(null);

  const socket = usePartySocket({
    host: window.location.hostname === 'localhost' ? 'localhost:1999' : process.env.PARTYKIT_HOST,
    room: room,
    query: { userId },
    onMessage(evt) {
      try {
        const data = JSON.parse(evt.data);

        // Handle server messages (connected, activeStatementChanged)
        if (data.type === 'connected' && data.activeStatementId) {
          onActiveStatementChange(data.activeStatementId);
        } else if (data.type === 'activeStatementChanged') {
          onActiveStatementChange(data.statementId);
        }
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    },
  });

  const sendCursorEvent = (type: CursorEvent['type'], position: CursorPosition) => {
    const event: CursorEvent = { type, position };
    socket.send(JSON.stringify(event));
  };

  const sendTimecode = () => {
    if (getTimecode) {
      socket.send(JSON.stringify({ type: 'setTimecode', timecode: getTimecode() }));
    }
  };

  // Heartbeat: re-send position every 2s while holding still, so Canvas's 3s staleness
  // timeout doesn't remove the cursor and incorrectly signal that the user lifted their finger.
  // Covers both touch (isDragging) and mouse hover (isMouseOver, for desktop debugging).
  useEffect(() => {
    if (!isDragging && !isMouseOver) return;
    const interval = setInterval(() => {
      if (lastPositionRef.current) {
        sendCursorEvent('touch', { ...lastPositionRef.current, timestamp: Date.now() });
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [isDragging, isMouseOver]);

  const getPixelPosition = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
    const layer = layerRef.current;
    if (!layer) return null;
    const rect = layer.getBoundingClientRect();
    if ('touches' in e) {
      const touch = e.touches.length > 0 ? e.touches[0] : e.changedTouches[0] ?? null;
      if (!touch) return null;
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const getCursorPosition = (e: React.MouseEvent | React.TouchEvent): CursorPosition => {
    const layer = layerRef.current;
    if (!layer) return { x: 0, y: 0, timestamp: Date.now(), userId };

    const rect = layer.getBoundingClientRect();
    let clientX: number, clientY: number;

    if ('touches' in e) {
      // For touch events, prioritize touches over changedTouches for active touches
      // Use the first available touch from either touches or changedTouches
      const touch = (e.touches && e.touches.length > 0) ? e.touches[0] :
                   (e.changedTouches && e.changedTouches.length > 0) ? e.changedTouches[0] : null;

      if (!touch) return { x: 0, y: 0, timestamp: Date.now(), userId };

      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // Convert to normalized coordinates (0-100)
    const pixelX = clientX - rect.left;
    const pixelY = clientY - rect.top;
    const normalizedX = (pixelX / dimensions.width) * 100;
    const normalizedY = (pixelY / dimensions.height) * 100;

    return {
      x: normalizedX,
      y: normalizedY,
      timestamp: Date.now(),
      userId
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Ignore synthesized mouse events that browsers fire ~300ms after a touch interaction.
    if (Date.now() - lastTouchTimeRef.current < 500) return;
    const position = getCursorPosition(e);
    lastPositionRef.current = position;
    setIsMouseOver(true);
    sendCursorEvent('move', position);
    onCursorEvent?.('move', { x: position.x, y: position.y });
    onTouchPosition?.(getPixelPosition(e));

    // Update reaction state based on cursor position
    const reactionState = computeReactionRegion(position.x, position.y, anchors ?? DEFAULT_ANCHORS);
    setUserReactionState(reactionState);
    currentReactionStateRef.current = reactionState;
    if (reactionStateRef) reactionStateRef.current = reactionState;
    onReactionStateChange(reactionState);
    onBackgroundColorChange(reactionState);
  };

  const handleMouseLeave = () => {
    if (Date.now() - lastTouchTimeRef.current < 500) return;
    setIsMouseOver(false);
    lastPositionRef.current = null;
    sendTimecode();
    // Send remove event when mouse leaves the canvas
    const position: CursorPosition = { x: 0, y: 0, timestamp: Date.now(), userId };
    sendCursorEvent('remove', position);
    onCursorEvent?.('remove', { x: 0, y: 0 });
    onTouchPosition?.(null);

    // Reset reaction state when mouse leaves
    setUserReactionState(null);
    currentReactionStateRef.current = null;
    if (reactionStateRef) reactionStateRef.current = null;
    onReactionStateChange(null);
    onBackgroundColorChange(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;

    const position = getCursorPosition(e);
    lastPositionRef.current = position;
    sendCursorEvent('touch', position);
    onCursorEvent?.('touch', { x: position.x, y: position.y });
    onTouchPosition?.(getPixelPosition(e));

    // Update reaction state without triggering React re-render during drag
    const reactionState = computeReactionRegion(position.x, position.y, anchors ?? DEFAULT_ANCHORS);
    currentReactionStateRef.current = reactionState;
    if (reactionStateRef) reactionStateRef.current = reactionState;
    onBackgroundColorChange(reactionState);
    // Don't call setUserReactionState or onReactionStateChange during drag to avoid interrupting touch
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    lastTouchTimeRef.current = Date.now();
    setIsDragging(true);
    const position = getCursorPosition(e);
    lastPositionRef.current = position;
    sendCursorEvent('touch', position);
    onCursorEvent?.('touch', { x: position.x, y: position.y });
    onTouchPosition?.(getPixelPosition(e));

    const reactionState = computeReactionRegion(position.x, position.y, anchors ?? DEFAULT_ANCHORS);
    currentReactionStateRef.current = reactionState;
    if (reactionStateRef) reactionStateRef.current = reactionState;
    onBackgroundColorChange(reactionState);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    lastTouchTimeRef.current = Date.now();
    setIsDragging(false);
    lastPositionRef.current = null;
    sendTimecode();
    onTouchPosition?.(null);

    const position: CursorPosition = { x: 0, y: 0, timestamp: Date.now(), userId };
    sendCursorEvent('remove', position);
    onCursorEvent?.('remove', { x: 0, y: 0 });

    currentReactionStateRef.current = null;
    if (reactionStateRef) reactionStateRef.current = null;
    setUserReactionState(null);
    onBackgroundColorChange(null);
    onReactionStateChange(null);
  };

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const offset = heightOffset ?? (window.innerWidth <= 768 ? 120 : 140);
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight - offset
      });
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial call

    return () => window.removeEventListener('resize', handleResize);
  }, [heightOffset]);

  return (
    <div
      ref={layerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 10, // Higher z-index to capture events
        touchAction: 'none',
        cursor: 'default',
        pointerEvents: 'auto',
        backgroundColor: 'transparent' // Completely transparent
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    />
  );
}
